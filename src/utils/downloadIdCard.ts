export const downloadIdCard = (
  subscriberId: string, 
  name: string = '', 
  classType: string = '', 
  packageType: string = '',
  svgElementId: string = 'qr-code-success'
) => {
  const svg = document.getElementById(svgElementId);
  if (!svg) return;
  
  const clonedSvg = svg.cloneNode(true) as HTMLElement;
  clonedSvg.setAttribute('width', '260');
  clonedSvg.setAttribute('height', '260');
  
  const svgData = new XMLSerializer().serializeToString(clonedSvg);
  const canvas = document.createElement("canvas");
  
  // High res for printing/downloading (Portrait layout)
  canvas.width = 800;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  const img = new Image();
  img.onload = () => {
    // 1. Background
    ctx.fillStyle = "#0f0f0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 2. Top Accent Border
    ctx.fillStyle = "#e9c400";
    ctx.fillRect(0, 0, canvas.width, 20);
    
    // 3. Title (FLIPLAB ACADEMY)
    ctx.fillStyle = "#e9c400";
    ctx.font = "italic 900 72px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FLIPLAB ACADEMY", canvas.width / 2, 120);
    
    // 4. Subtitle
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px monospace";
    ctx.fillText("OFFICIAL DIGITAL PASS", canvas.width / 2, 180);
    
    // Separator line
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(100, 240);
    ctx.lineTo(700, 240);
    ctx.stroke();

    // 5. Subscriber Name
    ctx.fillStyle = "#e9c400";
    ctx.font = "italic 900 56px sans-serif";
    ctx.fillText((name || "SUBSCRIBER").toUpperCase(), canvas.width / 2, 340);

    // 6. Class and Package Info
    if (classType || packageType) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px monospace";
      ctx.fillText(`[ ${classType.toUpperCase()} - ${packageType.toUpperCase()} ]`, canvas.width / 2, 400);
    }

    // 7. Draw the QR Code Background Box
    const qrSize = 460;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 500;
    
    // White background for QR code for scanning reliability
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
    
    // Draw QR image
    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
    
    // 8. ID Text
    ctx.fillStyle = "#888888";
    ctx.font = "bold 24px monospace";
    ctx.fillText(`ID: ${subscriberId}`, canvas.width / 2, qrY + qrSize + 60);

    // 9. Footer decoration
    ctx.fillStyle = "#e9c400";
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    // Bottom warning
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px monospace";
    ctx.fillText("PLEASE PRESENT THIS PASS AT THE FRONT DESK", canvas.width / 2, canvas.height - 60);
    
    // 10. Generate and trigger download
    const pngFile = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.download = `FLIPLAB_PASS_${subscriberId}.png`;
    downloadLink.href = `${pngFile}`;
    downloadLink.click();
  };
  
  // Convert SVG to data URI
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
};
