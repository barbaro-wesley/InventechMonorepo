const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\Wesley Barbaro\\Documents\\inventech-monorepo\\apps\\web\\src\\app\\(dashboard)\\equipamentos\\page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const fullPageCode = `export default function EquipamentosPage() {
  const [search, setSearch] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [patrimonyFilter, setPatrimonyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "">("");
  const [criticalityFilter, setCriticalityFilter] = useState<EquipmentCriticality | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [costCenterFilter, setCostCenterFilter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [qrTarget, setQrTarget] = useState<Equipment | null>(null);

  const { data: allTypes = [] } = useEquipmentTypes();
  const { data: allCostCenters = [] } = useCostCenters({ limit: 100 });
  const allLocations = allCostCenters.flatMap((cc) => cc.locations);

  const [formSheet, setFormSheet] = useState<{ open: boolean; target: Equipment | null }>({ open: false, target: null });
  const [detailSheet, setDetailSheet] = useState<Equipment | null>(null);
  const [moveSheet, setMoveSheet] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);

  const searchParams = useSearchParams();
  const detailId = searchParams.get("detail");
  const { data: detailData } = useEquipmentById(detailId ?? "");

  useEffect(() => {
    if (detailData) {
      setDetailSheet(detailData);
    }
  }, [detailData]);

  const { data: listData, isLoading } = useEquipment({
    search: search || undefined,
    ipAddress: ipFilter || undefined,
    patrimonyNumber: patrimonyFilter || undefined,
    status: (statusFilter as EquipmentStatus) || undefined,
    criticality: (criticalityFilter as EquipmentCriticality) || undefined,
    typeId: typeFilter || undefined,
    locationId: locationFilter || undefined,
    costCenterId: costCenterFilter || undefined,
    limit: 50,
  });

  const equipments = listData?.data ?? [];
  const total = listData?.total ?? 0;

  const activeFilterCount = [statusFilter, criticalityFilter, typeFilter, locationFilter, costCenterFilter, ipFilter, patrimonyFilter]
    .filter(Boolean).length;

  function clearAll() {
    setSearch("");
    setIpFilter("");
    setStatusFilter("");
    setCriticalityFilter("");
    setTypeFilter("");
    setLocationFilter("");
    setCostCenterFilter("");
    setPatrimonyFilter("");
  }

  const remove = useDeleteEquipment();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o parque de equipamentos.
          </p>
        </div>
        <Button onClick={() => setFormSheet({ open: true, target: null })}>
          <Plus className="w-4 h-4 mr-2" />
          Novo equipamento
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-3">
        {/* Row 1: search + toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Buscar por nome, marca, série, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EquipmentStatus | "")}
            className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABEL) as EquipmentStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={criticalityFilter}
            onChange={(e) => setCriticalityFilter(e.target.value as EquipmentCriticality | "")}
            className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todas as criticidades</option>
            {(Object.keys(CRITICALITY_LABEL) as EquipmentCriticality[]).map((c) => (
              <option key={c} value={c}>{CRITICALITY_LABEL[c]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={\`flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors \${
              showAdvanced || activeFilterCount > 0
                ? "border-primary text-primary bg-primary/5"
                : "border-border text-muted-foreground hover:bg-muted/30"
            }\`}
          >
            <Tag className="w-3.5 h-3.5" />
            Filtros avançados
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {activeFilterCount}
              </span>
            )}
          </button>
          {(search || activeFilterCount > 0) && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>

        {/* Row 2: advanced filters */}
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos os tipos</option>
              {allTypes.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={costCenterFilter}
              onChange={(e) => { setCostCenterFilter(e.target.value); setLocationFilter(""); }}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos os CC</option>
              {allCostCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.name}{cc.code ? \` (\${cc.code})\` : ""}</option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todas as localizações</option>
              {(costCenterFilter
                ? allLocations.filter((l) => allCostCenters.find(cc => cc.id === costCenterFilter)?.locations.some(ll => ll.id === l.id))
                : allLocations
              ).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <div className="relative">
              <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm w-44"
                placeholder="Filtrar por IP..."
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
              />
            </div>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9 text-sm w-44"
                placeholder="Patrimônio..."
                value={patrimonyFilter}
                onChange={(e) => setPatrimonyFilter(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-2xl border border-border bg-white animate-pulse" />
          ))}
        </div>
      ) : equipments.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-border py-14 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {search || activeFilterCount > 0 ? "Nenhum equipamento encontrado" : "Nenhum equipamento cadastrado"}
          </p>
          {!search && activeFilterCount === 0 && (
            <Button size="sm" className="mt-4" onClick={() => setFormSheet({ open: true, target: null })}>
              <Plus className="w-4 h-4 mr-2" />Cadastrar equipamento
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipments.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                onView={setDetailSheet}
                onEdit={(e) => setFormSheet({ open: true, target: e })}
                onMove={setMoveSheet}
                onDelete={setDeleteTarget}
                onPrint={setQrTarget}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            {equipments.length} de {total} equipamento(s)
          </p>
        </>
      )}

      {/* ── Sheets ── */}
      <EquipmentSheet
        open={formSheet.open}
        editTarget={formSheet.target}
        onClose={() => setFormSheet({ open: false, target: null })}
      />

      <DetailSheet
        open={!!detailSheet}
        equipment={detailSheet}
        onClose={() => setDetailSheet(null)}
        onEdit={(e) => { setDetailSheet(null); setFormSheet({ open: true, target: e }); }}
        onMove={(e) => { setDetailSheet(null); setMoveSheet(e); }}
        onPrint={(e) => { setDetailSheet(null); setQrTarget(e); }}
      />

      <MovementSheet
        open={!!moveSheet}
        equipment={moveSheet}
        onClose={() => setMoveSheet(null)}
      />

      <QRLabelModal
        open={!!qrTarget}
        equipment={qrTarget}
        onClose={() => setQrTarget(null)}
      />

      {/* ── Delete ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover equipamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              {remove.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Removendo...</> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}`;

const pageStartToken = 'export default function EquipamentosPage()';
const startIdx = content.indexOf(pageStartToken);

if (startIdx !== -1) {
    content = content.substring(0, startIdx) + fullPageCode;
    fs.writeFileSync(filePath, content);
    console.log('FINAL REPAIR SUCCESS');
} else {
    console.log('FINAL REPAIR FAILED: Page start not found');
}
