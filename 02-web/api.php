<?php
// KeyStorage API — 端到端加密金鑰儲存後端（MySQL 版）
// 伺服器只處理密文，永遠不接觸明文

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$config = require __DIR__ . '/config.php';

$RATE_LIMIT_DIR = __DIR__ . '/rate_limit';
$SESSION_TTL = 900; // 15 分鐘

if (!is_dir($RATE_LIMIT_DIR)) {
    mkdir($RATE_LIMIT_DIR, 0750, true);
}

// 連線 MySQL
try {
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4";
    $db = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => '資料庫連線失敗']);
    exit;
}

// 自動建表
$db->exec("CREATE TABLE IF NOT EXISTS `keys` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    encrypted_data TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$db->exec("CREATE TABLE IF NOT EXISTS meta (
    `key` VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Rate limiter
function checkRateLimit(string $dir): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $dir . '/' . md5($ip) . '.json';

    $data = ['attempts' => [], 'locked_until' => 0];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?? $data;
    }

    $now = time();
    if ($data['locked_until'] > $now) return false;

    $data['attempts'] = array_filter($data['attempts'], fn($t) => $t > $now - 300);
    if (count($data['attempts']) >= 5) {
        $data['locked_until'] = $now + 900;
        file_put_contents($file, json_encode($data));
        return false;
    }

    $data['attempts'][] = $now;
    file_put_contents($file, json_encode($data));
    return true;
}

// Session 驗證
function verifySession(PDO $db, int $ttl): bool {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/', $header, $m)) return false;
    $token = $m[1];

    $stmt = $db->prepare('SELECT value FROM meta WHERE `key` = :k');
    $stmt->execute([':k' => 'session_token']);
    $row = $stmt->fetch();
    if (!$row) return false;

    $session = json_decode($row['value'], true);
    if (!$session || $session['token'] !== $token) return false;
    if (time() - $session['last_active'] > $ttl) return false;

    $session['last_active'] = time();
    $stmt2 = $db->prepare('UPDATE meta SET value = :v WHERE `key` = :k');
    $stmt2->execute([':v' => json_encode($session), ':k' => 'session_token']);
    return true;
}

function getMeta(PDO $db, string $key): ?string {
    $stmt = $db->prepare('SELECT value FROM meta WHERE `key` = :k');
    $stmt->execute([':k' => $key]);
    $row = $stmt->fetch();
    return $row ? $row['value'] : null;
}

function setMeta(PDO $db, string $key, string $value): void {
    $stmt = $db->prepare('INSERT INTO meta (`key`, value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE value = :v2');
    $stmt->execute([':k' => $key, ':v' => $value, ':v2' => $value]);
}

function respond(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function respondError(string $msg, int $code = 400): never {
    respond(['error' => $msg], $code);
}

$authRequired = ['list', 'create', 'update', 'delete', 'touch', 'export', 'import'];
if (in_array($action, $authRequired) && !verifySession($db, $SESSION_TTL)) {
    respondError('未授權', 401);
}

switch ($action) {
    case 'get_meta':
        $salt = getMeta($db, 'pbkdf2_salt');
        if (!$salt) {
            respond(['initialized' => false]);
        }
        respond([
            'initialized' => true,
            'pbkdf2_salt' => $salt,
            'verify_cipher' => getMeta($db, 'verify_cipher'),
            'verify_iv' => getMeta($db, 'verify_iv'),
            'proof_hash' => getMeta($db, 'proof_hash'),
        ]);
        break;

    case 'init':
        if (getMeta($db, 'pbkdf2_salt')) {
            respondError('已初始化', 409);
        }
        foreach (['pbkdf2_salt', 'verify_cipher', 'verify_iv', 'proof_hash'] as $field) {
            if (empty($input[$field])) respondError("缺少 $field");
        }
        setMeta($db, 'pbkdf2_salt', $input['pbkdf2_salt']);
        setMeta($db, 'verify_cipher', $input['verify_cipher']);
        setMeta($db, 'verify_iv', $input['verify_iv']);
        setMeta($db, 'proof_hash', $input['proof_hash']);
        respond(['ok' => true]);
        break;

    case 'verify':
        if (!checkRateLimit($RATE_LIMIT_DIR)) {
            respondError('嘗試次數過多，請 15 分鐘後再試', 429);
        }
        $proof = $input['proof'] ?? '';
        $storedHash = getMeta($db, 'proof_hash');
        if (!$storedHash || $proof !== $storedHash) {
            respondError('密碼錯誤', 401);
        }
        $token = bin2hex(random_bytes(32));
        setMeta($db, 'session_token', json_encode([
            'token' => $token,
            'last_active' => time(),
        ]));
        respond(['session_token' => $token]);
        break;

    case 'list':
        $stmt = $db->query('SELECT id, encrypted_data, iv, created_at, updated_at, last_accessed_at FROM `keys` ORDER BY id DESC');
        respond(['keys' => $stmt->fetchAll()]);
        break;

    case 'create':
        if (empty($input['encrypted_data']) || empty($input['iv'])) {
            respondError('缺少加密資料');
        }
        $stmt = $db->prepare('INSERT INTO `keys` (encrypted_data, iv) VALUES (:data, :iv)');
        $stmt->execute([':data' => $input['encrypted_data'], ':iv' => $input['iv']]);
        respond(['id' => (int)$db->lastInsertId()]);
        break;

    case 'update':
        if (empty($input['id']) || empty($input['encrypted_data']) || empty($input['iv'])) {
            respondError('缺少必要欄位');
        }
        $stmt = $db->prepare('UPDATE `keys` SET encrypted_data = :data, iv = :iv WHERE id = :id');
        $stmt->execute([':data' => $input['encrypted_data'], ':iv' => $input['iv'], ':id' => $input['id']]);
        if ($stmt->rowCount() === 0) respondError('記錄不存在', 404);
        respond(['ok' => true]);
        break;

    case 'delete':
        if (empty($input['id'])) respondError('缺少 id');
        $stmt = $db->prepare('DELETE FROM `keys` WHERE id = :id');
        $stmt->execute([':id' => $input['id']]);
        if ($stmt->rowCount() === 0) respondError('記錄不存在', 404);
        respond(['ok' => true]);
        break;

    case 'touch':
        if (empty($input['id'])) respondError('缺少 id');
        $stmt = $db->prepare('UPDATE `keys` SET last_accessed_at = NOW() WHERE id = :id');
        $stmt->execute([':id' => $input['id']]);
        respond(['ok' => true]);
        break;

    case 'export':
        $stmt = $db->query('SELECT id, encrypted_data, iv, created_at, updated_at, last_accessed_at FROM `keys`');
        respond([
            'keys' => $stmt->fetchAll(),
            'meta' => [
                'pbkdf2_salt' => getMeta($db, 'pbkdf2_salt'),
                'verify_cipher' => getMeta($db, 'verify_cipher'),
                'verify_iv' => getMeta($db, 'verify_iv'),
                'proof_hash' => getMeta($db, 'proof_hash'),
            ],
        ]);
        break;

    case 'import':
        if (empty($input['keys']) || !is_array($input['keys'])) {
            respondError('缺少 keys 陣列');
        }
        // 備份現有資料
        $backup = $db->query('SELECT * FROM `keys`')->fetchAll();

        $db->beginTransaction();
        try {
            $db->exec('DELETE FROM `keys`');
            $stmt = $db->prepare('INSERT INTO `keys` (encrypted_data, iv, created_at, updated_at, last_accessed_at) VALUES (:data, :iv, :ca, :ua, :la)');
            foreach ($input['keys'] as $key) {
                $stmt->execute([
                    ':data' => $key['encrypted_data'],
                    ':iv' => $key['iv'],
                    ':ca' => $key['created_at'] ?? date('Y-m-d H:i:s'),
                    ':ua' => $key['updated_at'] ?? date('Y-m-d H:i:s'),
                    ':la' => $key['last_accessed_at'] ?? date('Y-m-d H:i:s'),
                ]);
            }
            $db->commit();
            respond(['ok' => true, 'imported' => count($input['keys']), 'backup_count' => count($backup)]);
        } catch (Exception $e) {
            $db->rollBack();
            respondError('匯入失敗：' . $e->getMessage(), 500);
        }
        break;

    default:
        respondError('未知的 action', 400);
}
