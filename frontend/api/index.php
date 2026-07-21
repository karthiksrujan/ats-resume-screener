<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$pos = strpos($path, '/api/');
if ($pos !== false) {
    $api_path = substr($path, $pos);
} else {
    $api_path = $path;
}

// 1. Intercept Database API requests
if (strpos($api_path, '/api/db/candidates') === 0) {
    // Database credentials on InfinityFree
    $host = 'sql112.infinityfree.com';
    $db_user = 'if0_42463966';
    $db_pass = 'Ka14ev0239';
    $db_name = 'if0_42463966_roman';

    try {
        $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Database connection failed: " . $e->getMessage()]);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'];
    header("Content-Type: application/json");

    if ($method === 'GET') {
        // Fetch candidates
        try {
            $stmt = $pdo->query("SELECT * FROM candidates ORDER BY score DESC, created_at DESC");
            $candidates = $stmt->fetchAll();
            echo json_encode(["success" => true, "candidates" => $candidates]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } 
    elseif ($method === 'POST') {
        // Insert candidate
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['name'])) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Invalid payload. Candidate name is required."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO candidates (name, email, phone, score, fit_tier, strengths, gaps, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['name'],
                $input['email'] ?? 'N/A',
                $input['phone'] ?? 'N/A',
                $input['score'] ?? 0,
                $input['fit_tier'] ?? 'Borderline',
                isset($input['strengths']) ? json_encode($input['strengths']) : '[]',
                isset($input['gaps']) ? json_encode($input['gaps']) : '[]',
                $input['status'] ?? 'Screened'
            ]);
            echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } 
    elseif ($method === 'PUT') {
        // Update candidate status
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['id']) || empty($input['status'])) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Candidate ID and status are required."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("UPDATE candidates SET status = ? WHERE id = ?");
            $stmt->execute([$input['status'], $input['id']]);
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } 
    elseif ($method === 'DELETE') {
        // Delete candidate
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $input['id'] ?? null;
        }

        if (!$id) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Candidate ID is required."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("DELETE FROM candidates WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
    } 
    else {
        http_response_code(405);
        echo json_encode(["success" => false, "error" => "Method not allowed."]);
    }
    exit;
}

// 2. Otherwise, proxy to the FastAPI Python server on Render
$backend_url = "https://ats-resume-screener-1-jqlc.onrender.com"; 
$target_url = $backend_url . $api_path;

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    
    // Forward post fields
    if (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false) {
        // For file uploads, we need to pass post files directly
        // We rebuild the postfields for curl using the $_POST and $_FILES arrays
        $postfields = array();
        foreach ($_POST as $key => $value) {
            $postfields[$key] = $value;
        }
        foreach ($_FILES as $key => $file) {
            if (is_array($file['tmp_name'])) {
                // Multi-file upload files[]
                for ($i = 0; $i < count($file['tmp_name']); $i++) {
                    if ($file['tmp_name'][$i]) {
                        $postfields[$key . '[' . $i . ']'] = new CURLFile(
                            $file['tmp_name'][$i],
                            $file['type'][$i],
                            $file['name'][$i]
                        );
                    }
                }
            } else {
                if ($file['tmp_name']) {
                    $postfields[$key] = new CURLFile(
                        $file['tmp_name'],
                        $file['type'],
                        $file['name']
                    );
                }
            }
        }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postfields);
    } else {
        $input = file_get_contents('php://input');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
        
        $headers = array('Content-Type: application/json');
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($http_code);
echo $response;
?>
