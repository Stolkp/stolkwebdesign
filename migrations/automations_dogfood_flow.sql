-- Dogfood-flow: "Nieuwe lead opvolging", templates + actieve automation.
-- Volgt echte leads uit stolkwebdesign_client_projects (bridge-trigger uit automations_triggers.sql).

insert into stolkwebdesign_automation_email_templates (id, naam, onderwerp, html) values
('11111111-1111-1111-1111-111111111101', 'welkom-nieuwe-lead',
 'Je aanvraag is binnen, {{voornaam|hallo}}', $html$<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bedankt voor je aanvraag</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">
  <tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
    <span style="font-size:18px;font-weight:bold;letter-spacing:1px;color:#0a0a0a;">STOLK<span style="color:#e63329;">WEB</span>DESIGN</span>
  </td></tr>
  <tr><td style="padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;">
    <p style="margin:0 0 16px;">Hoi {{voornaam|daar}},</p>
    <p style="margin:0 0 16px;">Bedankt voor je bericht. Ik heb je aanvraag binnen en kom er persoonlijk op terug, meestal dezelfde werkdag nog.</p>
    <p style="margin:0 0 16px;">Wil je alvast een indruk van het werk? Bekijk een paar recente projecten:</p>
    <p style="margin:0 0 24px;"><a href="https://stolkwebdesign.nl/#werk" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:16px;">Bekijk recent werk</a></p>
    <p style="margin:0 0 16px;">Liever direct een moment prikken? Dat kan ook:</p>
    <p style="margin:0 0 24px;"><a href="https://stolkwebdesign.nl/contact.html" style="color:#e63329;">Plan een kennismaking</a></p>
    <p style="margin:0;">Groet,<br>Peter Stolk<br><span style="color:#888;">Stolkwebdesign</span></p>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;">
    Geen mail meer ontvangen? <a href="{{unsubscribe_url}}" style="color:#888;">Schrijf je uit</a>.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
$html$),
('11111111-1111-1111-1111-111111111102', 'reminder-nieuwe-lead',
 'Nog even over je aanvraag', $html$<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nog even over je aanvraag</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;">
  <tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
    <span style="font-size:18px;font-weight:bold;letter-spacing:1px;color:#0a0a0a;">STOLK<span style="color:#e63329;">WEB</span>DESIGN</span>
  </td></tr>
  <tr><td style="padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;">
    <p style="margin:0 0 16px;">Hoi {{voornaam|daar}},</p>
    <p style="margin:0 0 16px;">Een paar dagen terug stuurde je een aanvraag via stolkwebdesign.nl. Ik wil zeker weten dat mijn reactie je bereikt heeft.</p>
    <p style="margin:0 0 16px;">Staat een nieuwe website nog op de planning? Dan denk ik graag met je mee. Een kort gesprek is vrijblijvend en geeft je meteen een beeld van de mogelijkheden en de investering.</p>
    <p style="margin:0 0 24px;"><a href="https://stolkwebdesign.nl/contact.html" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:16px;">Plan een kort gesprek</a></p>
    <p style="margin:0;">Groet,<br>Peter Stolk<br><span style="color:#888;">Stolkwebdesign</span></p>
  </td></tr>
  <tr><td style="padding:16px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888;">
    Geen mail meer ontvangen? <a href="{{unsubscribe_url}}" style="color:#888;">Schrijf je uit</a>.
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
$html$)
on conflict (naam) do update set onderwerp = excluded.onderwerp, html = excluded.html;

insert into stolkwebdesign_automations (id, naam, status, trigger_type, graph) values
('11111111-1111-1111-1111-111111111100', 'Nieuwe lead opvolging', 'active', 'form',
'{
  "entry": "n1",
  "nodes": {
    "n1": {"type": "trigger_form", "next": "n2"},
    "n2": {"type": "send_email", "config": {"template_id": "11111111-1111-1111-1111-111111111101"}, "next": "n3"},
    "n3": {"type": "wait", "config": {"days": 2}, "next": "n4"},
    "n4": {"type": "condition", "config": {"check": "email_clicked", "of_node": "n2"}, "yes": "n5", "no": "n6"},
    "n5": {"type": "notify_owner", "config": {"message": "{{naam}} ({{email}}) klikte in de welkomstmail. Warme lead, pak op."}, "next": "n7"},
    "n6": {"type": "send_email", "config": {"template_id": "11111111-1111-1111-1111-111111111102"}, "next": "n7"},
    "n7": {"type": "goal", "config": {"name": "opvolging afgerond"}}
  }
}')
on conflict (id) do update set graph = excluded.graph, status = 'active';
