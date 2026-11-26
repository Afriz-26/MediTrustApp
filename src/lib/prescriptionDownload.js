// Professional printable prescription. Opens an A4 page in a new tab and opens the print dialog:
// choose "Save as PDF" as the destination to get a PDF file. No extra libraries needed.

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const nl2br = (value) => esc(value).replace(/\n/g, '<br>');

const formatDate = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const doctorTitle = (name) => {
  const n = String(name || '').trim();
  return /^dr\.?\s/i.test(n) ? n : `Dr. ${n}`;
};

export function buildPrescriptionHtml(rx, options = {}) {
  const medicines = Array.isArray(rx.medicines) ? rx.medicines : [];
  const code = String(rx.id || '').replace(/-/g, '').slice(0, 8).toUpperCase() || 'N/A';
  const doctor = doctorTitle(rx.doctor_name || 'Doctor');
  const clinicLine = [rx.doctor_clinic, rx.doctor_clinic_address, rx.doctor_city].filter(Boolean).join(', ');

  const rows = medicines.length
    ? medicines.map((m, i) => `
        <tr>
          <td class="n">${i + 1}</td>
          <td class="med"><strong>${esc(m.name || 'Medicine')}</strong>${m.instructions ? `<div class="ins">${esc(m.instructions)}</div>` : ''}</td>
          <td>${esc(m.dosage || '-')}</td>
          <td>${esc(m.frequency || '-')}</td>
          <td>${esc(m.duration || '-')}</td>
        </tr>`).join('')
    : '<tr><td colspan="5" class="empty">No medicines listed</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prescription ${esc(code)} - MediTrust</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e5e7eb; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; font-size: 13px; line-height: 1.45; }
  .toolbar { position: sticky; top: 0; z-index: 5; background: #111827; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; justify-content: space-between; font-size: 13px; }
  .toolbar button { background: #10b981; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .page { width: 210mm; min-height: 297mm; margin: 12px auto; background: #fff; position: relative; box-shadow: 0 2px 12px rgba(0,0,0,.15); display: flex; flex-direction: column; }
  .band { height: 8mm; background: linear-gradient(90deg, #2563eb, #0ea5e9 55%, #10b981); }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding: 8mm 12mm 4mm; }
  .brand { font-size: 24px; font-weight: 800; letter-spacing: .3px; color: #1d4ed8; }
  .brand span { color: #059669; }
  .tag { font-size: 10.5px; color: #6b7280; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; color: #374151; }
  .meta .title { font-size: 15px; font-weight: 700; color: #111827; letter-spacing: 1.5px; text-transform: uppercase; }
  .meta .code { margin-top: 3px; font-family: Consolas, monospace; font-size: 12px; color: #1d4ed8; }
  .people { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; padding: 2mm 12mm 0; }
  .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px 12px; background: #f9fafb; }
  .box h4 { margin: 0 0 5px; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #6b7280; font-weight: 700; }
  .box .name { font-size: 15px; font-weight: 700; color: #111827; }
  .box .sub { color: #4b5563; font-size: 12px; }
  .box .reg { margin-top: 3px; font-size: 12px; color: #111827; }
  .dx { margin: 5mm 12mm 0; padding: 9px 12px; border-left: 4px solid #2563eb; background: #eff6ff; border-radius: 0 8px 8px 0; }
  .dx h4 { margin: 0 0 3px; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #1d4ed8; }
  .dx p { margin: 0; font-size: 14px; font-weight: 600; }
  .rx { display: flex; align-items: center; gap: 8px; margin: 6mm 12mm 2mm; }
  .rx .sym { font-size: 34px; font-weight: 700; color: #059669; font-family: Georgia, serif; line-height: 1; }
  .rx .line { flex: 1; height: 1px; background: #d1d5db; }
  table { width: calc(100% - 24mm); margin: 0 12mm; border-collapse: collapse; }
  th { background: #f3f4f6; text-align: left; font-size: 10.5px; letter-spacing: .8px; text-transform: uppercase; color: #4b5563; padding: 8px 10px; border-bottom: 2px solid #d1d5db; }
  td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.n { width: 8mm; color: #6b7280; }
  td.med strong { font-size: 13.5px; color: #111827; }
  .ins { font-size: 11.5px; color: #6b7280; margin-top: 2px; font-style: italic; }
  .empty { text-align: center; color: #9ca3af; padding: 18px; }
  .notes { margin: 5mm 12mm 0; padding: 9px 12px; border: 1px dashed #f59e0b; background: #fffbeb; border-radius: 8px; }
  .notes h4 { margin: 0 0 3px; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: #b45309; }
  .grow { flex: 1; min-height: 12mm; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; padding: 0 12mm 6mm; gap: 10mm; }
  .stamp { border: 1.5px solid #059669; color: #047857; border-radius: 8px; padding: 7px 11px; font-size: 11px; line-height: 1.35; max-width: 82mm; }
  .stamp b { display: block; font-size: 11.5px; letter-spacing: .6px; text-transform: uppercase; }
  .sigbox { text-align: center; min-width: 62mm; }
  .sigline { border-top: 1.5px solid #111827; padding-top: 4px; font-weight: 700; font-size: 13px; }
  .sigsub { font-size: 11.5px; color: #4b5563; }
  .foot { border-top: 1px solid #e5e7eb; padding: 4mm 12mm 6mm; font-size: 10px; color: #6b7280; background: #f9fafb; }
  .foot strong { color: #374151; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .page { margin: 0; box-shadow: none; width: 210mm; min-height: 297mm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media (max-width: 800px) { .page { width: 100%; } }
  .wm { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 800; color: rgba(220, 38, 38, .13); transform: rotate(-18deg); pointer-events: none; letter-spacing: 2px; }
</style>
</head>
<body>
<div class="toolbar">
  <span>To save as PDF: press <b>Save as PDF / Print</b>, then choose <b>Save as PDF</b> as the printer.</span>
  <button onclick="window.print()">Save as PDF / Print</button>
</div>
<div class="page">
  ${options.preview ? '<div class="wm">PREVIEW &middot; NOT ISSUED YET</div>' : ''}
  <div class="band"></div>
  <div class="head">
    <div>
      <div class="brand">Medi<span>Trust</span></div>
      <div class="tag">Health Care You Can Trust</div>
    </div>
    <div class="meta">
      <div class="title">Prescription</div>
      <div>Date: <strong>${esc(formatDate(rx.created_date))}</strong></div>
      <div class="code">Rx No. ${esc(code)}</div>
    </div>
  </div>

  <div class="people">
    <div class="box">
      <h4>Doctor</h4>
      <div class="name">${esc(doctor)}</div>
      <div class="sub">${esc([rx.doctor_qualification, rx.doctor_specialization].filter(Boolean).join(' · ')) || '&nbsp;'}</div>
      <div class="reg">Reg. No.: <strong>${esc(rx.doctor_license || 'Not provided')}</strong></div>
      ${clinicLine ? `<div class="sub" style="margin-top:3px">${esc(clinicLine)}</div>` : ''}
    </div>
    <div class="box">
      <h4>Patient</h4>
      <div class="name">${esc(rx.patient_name || 'Patient')}</div>
      <div class="sub">${esc(rx.patient_email || '')}</div>
    </div>
  </div>

  ${rx.diagnosis ? `<div class="dx"><h4>Diagnosis</h4><p>${nl2br(rx.diagnosis)}</p></div>` : ''}

  <div class="rx"><span class="sym">&#8478;</span><span class="line"></span></div>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${rx.additional_notes ? `<div class="notes"><h4>Doctor's notes</h4>${nl2br(rx.additional_notes)}</div>` : ''}

  <div class="grow"></div>
  <div class="sign">
    <div class="stamp"><b>Digitally issued</b>Issued electronically through MediTrust by ${esc(doctor)}.<br>Verification code: <strong>${esc(code)}</strong></div>
    <div class="sigbox">
      <div style="height:14mm"></div>
      <div class="sigline">${esc(doctor)}</div>
      <div class="sigsub">${esc(rx.doctor_specialization || '')}${rx.doctor_license ? ` · Reg. ${esc(rx.doctor_license)}` : ''}</div>
    </div>
  </div>
  <div class="foot">
    <strong>Valid only for the patient named above.</strong> Take medicines exactly as directed by your doctor. Do not share this prescription.
    In an emergency call 108. This is an electronic prescription generated on MediTrust; MediTrust does not provide medical advice.
  </div>
</div>
${options.preview ? '' : "<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>"}
</body>
</html>`;
}

export function downloadPrescription(prescription, options = {}) {
  const popup = window.open('', '_blank');
  if (!popup) {
    window.alert('Please allow pop-ups for this site, then press Download again.');
    return;
  }
  popup.document.open();
  popup.document.write(buildPrescriptionHtml(prescription, options));
  popup.document.close();
}
