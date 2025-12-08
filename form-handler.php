<?php
// Form Handler for House Lot & Land Sales Co. LLC
// This file processes form submissions and sends emails

// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set headers for AJAX requests
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Get form data
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    $input = $_POST;
}

// Validate required fields
$required_fields = ['name', 'phone', 'email'];
$missing_fields = [];

foreach ($required_fields as $field) {
    if (empty($input[$field])) {
        $missing_fields[] = $field;
    }
}

if (!empty($missing_fields)) {
    http_response_code(400);
    echo json_encode([
        'success' => false, 
        'message' => 'Missing required fields: ' . implode(', ', $missing_fields)
    ]);
    exit;
}

// Sanitize and validate data
$name = filter_var($input['name'], FILTER_SANITIZE_STRING);
$phone = filter_var($input['phone'], FILTER_SANITIZE_STRING);
$email = filter_var($input['email'], FILTER_SANITIZE_EMAIL);

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

// Get optional fields
$property_address = isset($input['property-address']) ? filter_var($input['property-address'], FILTER_SANITIZE_STRING) : '';
$property_type = isset($input['property-type']) ? filter_var($input['property-type'], FILTER_SANITIZE_STRING) : '';
$property_condition = isset($input['property-condition']) ? filter_var($input['property-condition'], FILTER_SANITIZE_STRING) : '';
$timeline = isset($input['timeline']) ? filter_var($input['timeline'], FILTER_SANITIZE_STRING) : '';
$property_details = isset($input['property-details']) ? filter_var($input['property-details'], FILTER_SANITIZE_STRING) : '';
$consent = isset($input['consent']) ? true : false;

// Determine form type
$form_type = isset($input['form_type']) ? $input['form_type'] : 'Cash Offer Request';

// Email configuration
$to_email = 'houselotandland@gmail.com';
$subject = 'New ' . $form_type . ' - House Lot & Land Sales Co. LLC';

// Build email content
$email_content = "
New {$form_type} Submission

Contact Information:
- Name: {$name}
- Phone: {$phone}
- Email: {$email}

Property Information:";

if ($property_address) {
    $email_content .= "\n- Address: {$property_address}";
}
if ($property_type) {
    $email_content .= "\n- Property Type: {$property_type}";
}
if ($property_condition) {
    $email_content .= "\n- Condition: {$property_condition}";
}
if ($timeline) {
    $email_content .= "\n- Timeline: {$timeline}";
}
if ($property_details) {
    $email_content .= "\n- Additional Details: {$property_details}";
}

$email_content .= "\n\nConsent Given: " . ($consent ? 'Yes' : 'No');

$email_content .= "

Submission Details:
- Date: " . date('Y-m-d H:i:s') . "
- IP Address: " . $_SERVER['REMOTE_ADDR'] . "
- User Agent: " . $_SERVER['HTTP_USER_AGENT'] . "

---
This email was sent from the House Lot & Land Sales Co. LLC website contact form.
";

// Email headers
$headers = [
    'From: noreply@houselotandland.com',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion(),
    'Content-Type: text/plain; charset=UTF-8'
];

// Send email
$mail_sent = mail($to_email, $subject, $email_content, implode("\r\n", $headers));

// Send confirmation email to customer
$customer_subject = 'Thank you for your inquiry - House Lot & Land Sales Co. LLC';
$customer_content = "
Dear {$name},

Thank you for contacting House Lot & Land Sales Co. LLC!

We have received your {$form_type} and will review your information within 24 hours. You can expect to hear from us soon with your cash offer or to discuss your property further.

What happens next:
1. We'll review your property details
2. You'll receive a fair, no-obligation cash offer within 24 hours
3. No pressure - you decide if the offer works for you

If you have any immediate questions, feel free to call us at 214-702-1519.

Best regards,
House Lot & Land Sales Co. LLC Team
214-702-1519
houselotandland@gmail.com

---
This is an automated response. Please do not reply to this email.
";

$customer_headers = [
    'From: noreply@houselotandland.com',
    'Reply-To: houselotandland@gmail.com',
    'X-Mailer: PHP/' . phpversion(),
    'Content-Type: text/plain; charset=UTF-8'
];

$customer_mail_sent = mail($email, $customer_subject, $customer_content, implode("\r\n", $customer_headers));

// Log submission (optional)
$log_entry = date('Y-m-d H:i:s') . " - {$form_type} from {$name} ({$email}) - " . ($mail_sent ? 'SUCCESS' : 'FAILED') . "\n";
file_put_contents('form_submissions.log', $log_entry, FILE_APPEND | LOCK_EX);

// Return response
if ($mail_sent) {
    echo json_encode([
        'success' => true,
        'message' => 'Thank you! We\'ll contact you within 24 hours.',
        'confirmation_sent' => $customer_mail_sent
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Sorry, there was an error sending your message. Please try calling us at 214-702-1519.'
    ]);
}
?> 