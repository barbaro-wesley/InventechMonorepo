const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\Wesley Barbaro\\Documents\\inventech-monorepo\\apps\\web\\src\\app\\(dashboard)\\equipamentos\\page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const movementRowCode = `function MovementRow({ movement }: { movement: Movement }) {
  const isActive = movement.status === "ACTIVE";
  const isLoan = movement.type === "LOAN";
  return (
    <div className={\`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs \${isActive ? "border-amber-200 bg-amber-50/60" : "border-border bg-muted/20"}\`}>
      <div className="flex-shrink-0 mt-0.5">
        {isLoan ? <HandCoins className="w-3.5 h-3.5 text-amber-500" /> : <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium">{isLoan ? "Empréstimo" : "Transferência"}</span>
          {isActive && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Em andamento</span>}
          {movement.status === "RETURNED" && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Devolvido</span>}
          {movement.status === "CANCELLED" && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Cancelado</span>}
        </div>
        <p className="text-muted-foreground mt-0.5">{movement.origin.name} → {movement.destination.name}</p>
        {movement.reason && <p className="text-muted-foreground truncate">{movement.reason}</p>}
        <p className="text-muted-foreground mt-0.5">{new Date(movement.createdAt).toLocaleDateString("pt-BR")}</p>
      </div>
    </div>
  );
}`;

const equipmentCardCode = `function EquipmentCard({
  equipment,
  onView,
  onEdit,
  onMove,
  onDelete,
  onPrint,
}: {
  equipment: Equipment;
  onView: (e: Equipment) => void;
  onEdit: (e: Equipment) => void;
  onMove: (e: Equipment) => void;
  onDelete: (e: Equipment) => void;
  onPrint: (e: Equipment) => void;
}) {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #3b82f6, #f97316)" }}
        >
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <StatusBadge status={equipment.status} />
      </div>

      {/* Title */}
      <div className="px-5 pb-3">
        <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--foreground)" }}>
          {equipment.name}
        </p>
        {equipment.type && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {[equipment.type.name, equipment.subtype?.name].filter(Boolean).join(" › ")}
          </p>
        )}
        <div className="mt-1.5">
          <CriticalityBadge criticality={equipment.criticality} />
        </div>
      </div>

      {/* Fields */}
      <div className="px-5 pb-4 space-y-1.5 flex-1">
        {equipment.patrimonyNumber && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Patrimônio</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{equipment.patrimonyNumber}</span>
          </div>
        )}
        {(equipment.brand || equipment.model) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Modelo</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{[equipment.brand, equipment.model].filter(Boolean).join(" ")}</span>
          </div>
        )}
        {equipment.serialNumber && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Série</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{equipment.serialNumber}</span>
          </div>
        )}
        {equipment.costCenter && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Centro</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{equipment.costCenter.name}</span>
          </div>
        )}
        {equipment.currentLocation && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-20 flex-shrink-0">Localização</span>
            <span className="text-slate-700 dark:text-slate-300 truncate">{equipment.currentLocation.name}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEdit(equipment)}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" />Editar
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onView(equipment)}>
          <Eye className="w-3.5 h-3.5 mr-1.5" />Detalhes
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {equipment.status === "ACTIVE" && (
              <DropdownMenuItem onClick={() => onMove(equipment)}>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />Movimentar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onPrint(equipment)}>
              <Printer className="w-3.5 h-3.5 text-muted-foreground mr-2" />Imprimir QR
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={equipment._count.serviceOrders > 0}
              onClick={() => onDelete(equipment)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              {equipment._count.serviceOrders > 0 ? "Possui OS vinculadas" : "Remover"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}`;

const startToken = '    </Sheet>\\n  );\\n}';
const startIdx = content.indexOf('    </Sheet>\n  );\n}');
const endIdx = content.indexOf('// ─── QR Label Print');

if (startIdx !== -1 && endIdx !== -1) {
    const preamble = content.substring(0, startIdx + 15); // Adjust index to include closing braces
    const postscript = content.substring(endIdx);
    content = preamble + '\n\n' + movementRowCode + '\n\n' + equipmentCardCode + '\n\n' + postscript;
    fs.writeFileSync(filePath, content);
    console.log('REPAIR SUCCESS');
} else {
    console.log('REPAIR FAILED: Markers not found', startIdx, endIdx);
}
