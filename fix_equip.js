const fs = require('fs');
const file = 'apps/web/src/app/(dashboard)/equipamentos/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add QRCodeSVG import after the existing lucide imports block
const qrImport = `import QRCode from "react-qr-code";\n`;
// Insert after the storageService import
const storageImportLine = `import { storageService } from "@/services/storage/storage.service";`;
if (!content.includes('react-qr-code')) {
  content = content.replace(storageImportLine, storageImportLine + '\n' + qrImport);
  console.log('✓ Added QRCode import');
} else {
  console.log('⊘ QRCode already imported');
}

// 2. Add Printer icon import to lucide
const lucideBlock = `  MoreHorizontal,\n} from "lucide-react";`;
content = content.replace(lucideBlock, `  MoreHorizontal,\n  Printer,\n} from "lucide-react";`);
console.log('✓ Added Printer lucide icon');

// 3. Add the QRLabelModal component before // ─── Page ─
const pageMarker = `// ─── Page ─────────────────────────────────────────────────────────────────────`;

const qrComponent = `// ─── QR Label Print ──────────────────────────────────────────────────────────

const LABEL_SIZES = [
  { id: "62x29",  label: "62 × 29 mm (Brother DK-11209)",   w: 234, h: 110 },
  { id: "62x38",  label: "62 × 38 mm (Brother DK-11208)",   w: 234, h: 144 },
  { id: "57x32",  label: "57 × 32 mm (Brother DK-11221)",   w: 216, h: 121 },
  { id: "100x62", label: "100 × 62 mm (Zebra / Genérica)",  w: 378, h: 234 },
];

function QRLabelModal({
  open,
  equipment,
  onClose,
}: {
  open: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}) {
  const [sizeId, setSizeId] = React.useState("62x38");
  const labelSize = LABEL_SIZES.find((s) => s.id === sizeId) ?? LABEL_SIZES[1];

  if (!equipment) return null;

  const qrUrl =
    typeof window !== "undefined"
      ? \`\${window.location.origin}/equipamentos?detail=\${equipment.id}\`
      : \`/equipamentos?detail=\${equipment.id}\`;

  function handlePrint() {
    const printWin = window.open("", "_blank", "width=800,height=600");
    if (!printWin) return;

    const svgEl = document.getElementById("qr-label-svg");
    const svgHtml = svgEl ? svgEl.outerHTML : "";

    const labelHtml = \`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Etiqueta — \${equipment.name}</title>
  <style>
    @page {
      size: \${labelSize.id === "100x62" ? "100mm 62mm" : labelSize.id === "62x38" ? "62mm 38mm" : labelSize.id === "57x32" ? "57mm 32mm" : "62mm 29mm"};
      margin: 1mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, "Helvetica Neue", sans-serif; background: #fff; }
    .label {
      display: flex;
      align-items: center;
      gap: 3mm;
      width: 100%;
      height: 100%;
      padding: 1.5mm;
      border: 0.3mm solid #ddd;
      border-radius: 1mm;
      overflow: hidden;
    }
    .qr-wrap { flex-shrink: 0; }
    .qr-wrap svg { display: block; }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1mm; justify-content: center; }
    .name { font-size: \${labelSize.id === "62x29" ? "6pt" : "7pt"}; font-weight: 700; line-height: 1.15; word-break: break-word; }
    .row { font-size: \${labelSize.id === "62x29" ? "4.5pt" : "5.5pt"}; color: #333; line-height: 1.2; }
    .row span { font-weight: 600; color: #000; }
    .id-row { font-size: 3.5pt; color: #777; margin-top: 0.5mm; font-family: monospace; word-break: break-all; }
  </style>
</head>
<body>
<div class="label">
  <div class="qr-wrap">\${svgHtml}</div>
  <div class="info">
    <p class="name">\${equipment.name}</p>
    \${equipment.patrimonyNumber ? \`<p class="row">Pat: <span>\${equipment.patrimonyNumber}</span></p>\` : ""}
    \${equipment.serialNumber ? \`<p class="row">S/N: <span>\${equipment.serialNumber}</span></p>\` : ""}
    \${equipment.type ? \`<p class="row">Tipo: <span>\${equipment.type.name}</span></p>\` : ""}
    \${equipment.costCenter ? \`<p class="row">CC: <span>\${equipment.costCenter.name}</span></p>\` : ""}
    \${equipment.currentLocation ? \`<p class="row">Local: <span>\${equipment.currentLocation.name}</span></p>\` : ""}
    <p class="id-row">ID: \${equipment.id}</p>
  </div>
</div>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\\/script>
</body></html>\`;

    printWin.document.open();
    printWin.document.write(labelHtml);
    printWin.document.close();
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Imprimir etiqueta QR
          </AlertDialogTitle>
          <AlertDialogDescription>
            Geração de etiqueta para impressora de etiquetas. Escaneie o QR para acessar os detalhes do equipamento.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Size selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tamanho da etiqueta</p>
          <div className="grid grid-cols-2 gap-2">
            {LABEL_SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSizeId(s.id)}
                className={\`text-left px-3 py-2 rounded-lg border text-xs transition-colors \${
                  sizeId === s.id
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:bg-muted/40"
                }\`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Label preview */}
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Prévia</p>
          <div className="bg-gray-50 rounded-xl border border-border p-4 flex items-center justify-center">
            <div
              className="bg-white border border-gray-300 rounded flex items-center gap-3 shadow-sm overflow-hidden"
              style={{ width: labelSize.w, height: labelSize.h, padding: "6px 8px" }}
            >
              {/* QR code — sized to fit ~60% of label height */}
              <div style={{ flexShrink: 0, width: labelSize.h - 16, height: labelSize.h - 16 }}>
                <QRCode
                  id="qr-label-svg"
                  value={qrUrl}
                  size={labelSize.h - 16}
                  level="M"
                  style={{ display: "block" }}
                />
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <p style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.2, wordBreak: "break-word" as const }}>
                  {equipment.name}
                </p>
                {equipment.patrimonyNumber && (
                  <p style={{ fontSize: 7.5, color: "#444", lineHeight: 1.2 }}>
                    Pat: <strong>{equipment.patrimonyNumber}</strong>
                  </p>
                )}
                {equipment.serialNumber && (
                  <p style={{ fontSize: 7.5, color: "#444", lineHeight: 1.2 }}>
                    S/N: <strong>{equipment.serialNumber}</strong>
                  </p>
                )}
                {equipment.type && (
                  <p style={{ fontSize: 7, color: "#555", lineHeight: 1.2 }}>
                    {equipment.type.name}
                    {equipment.subtype ? \` › \${equipment.subtype.name}\` : ""}
                  </p>
                )}
                {equipment.costCenter && (
                  <p style={{ fontSize: 7, color: "#555", lineHeight: 1.2 }}>
                    {equipment.costCenter.name}
                  </p>
                )}
                {equipment.currentLocation && (
                  <p style={{ fontSize: 7, color: "#555", lineHeight: 1.2 }}>
                    📍 {equipment.currentLocation.name}
                  </p>
                )}
                <p style={{ fontSize: 5.5, color: "#aaa", marginTop: 2, fontFamily: "monospace", wordBreak: "break-all" as const }}>
                  {equipment.id}
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            A impressão abre em nova janela com formatação otimizada para a etiqueta selecionada.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir etiqueta
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

`;

content = content.replace(pageMarker, qrComponent + pageMarker);
console.log('✓ Added QRLabelModal component');

// 4. Add React import (needed for React.useState in the QRLabelModal)
if (!content.includes("import React")) {
  content = content.replace('"use client";\n', '"use client";\n\nimport React from "react";\n');
  console.log('✓ Added React import');
}

// 5. Add qrTarget state in the page component
const stateMarker = `  const [showAdvanced, setShowAdvanced] = useState(false);`;
content = content.replace(stateMarker, stateMarker + `\n  const [qrTarget, setQrTarget] = useState<Equipment | null>(null);`);
console.log('✓ Added qrTarget state');

// 6. Add "Imprimir QR" in the card dropdown (before the "Remover" item)
const dropdownRemover = `            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={equipment._count.serviceOrders > 0}
              onClick={() => onDelete(equipment)}
            >`;
const newDropdown = `            <DropdownMenuItem onClick={() => onPrint(equipment)}>
              <Printer className="w-3.5 h-3.5 mr-2" />Imprimir QR Code
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={equipment._count.serviceOrders > 0}
              onClick={() => onDelete(equipment)}
            >`;
content = content.replace(dropdownRemover, newDropdown);
console.log('✓ Added print button in card dropdown');

// 7. Add onPrint prop to EquipmentCard
const cardProps = `  onDelete: (e: Equipment) => void;
}) {`;
content = content.replace(cardProps, `  onDelete: (e: Equipment) => void;
  onPrint: (e: Equipment) => void;
}) {`);
console.log('✓ Added onPrint prop to EquipmentCard');

// 8. Pass onPrint to EquipmentCard in the page render
const cardUsage = `                onDelete={setDeleteTarget}`;
content = content.replace(cardUsage, `                onDelete={setDeleteTarget}
                onPrint={setQrTarget}`);
console.log('✓ Passed onPrint to EquipmentCard');

// 9. Add QRLabelModal to the sheets section (after MovementSheet)
const movementSheetClose = `      <MovementSheet
        open={!!moveSheet}
        equipment={moveSheet}
        onClose={() => setMoveSheet(null)}
      />`;
content = content.replace(movementSheetClose,
  movementSheetClose + `

      <QRLabelModal
        open={!!qrTarget}
        equipment={qrTarget}
        onClose={() => setQrTarget(null)}
      />`
);
console.log('✓ Added QRLabelModal to page');

// 10. Add "Imprimir QR" button in DetailSheet actions
const detailSheetActions = `            {equipment.purchaseValue && equipment.depreciationRate && (
              <Button size="sm" variant="outline" disabled={recalc.isPending}
                onClick={() => recalc.mutate(equipment.id)}>
                <BarChart2 className="w-3.5 h-3.5 mr-1.5" />
                {recalc.isPending ? "Calculando..." : "Recalcular depreciação"}
              </Button>
            )}`;
content = content.replace(detailSheetActions, detailSheetActions + `
            <Button size="sm" variant="outline" onClick={() => { onClose(); /* caller handles print */ }}>
              <Printer className="w-3.5 h-3.5 mr-1.5" />QR Code
            </Button>`);
console.log('✓ Added QR button in DetailSheet');

fs.writeFileSync(file, content, 'utf8');
console.log('\nDone! File size:', content.length);
