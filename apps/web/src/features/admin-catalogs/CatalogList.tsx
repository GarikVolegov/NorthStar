import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EducationForm } from "./EducationForm";
import { GrowthArticleForm } from "./GrowthArticleForm";
import { ProfessionForm } from "./ProfessionForm";
import { SectorForm } from "./SectorForm";
import { deleteCatalogItem } from "./api";
import { ListRow } from "./shared";
import type {
  CatalogResource,
  CatalogTab,
  EducationPath,
  GrowthArticle,
  Profession,
  Sector,
} from "./types";

type CatalogResources = {
  sectors: CatalogResource<Sector>;
  professions: CatalogResource<Profession>;
  "education-paths": CatalogResource<EducationPath>;
  "growth-articles": CatalogResource<GrowthArticle>;
};

export function CatalogList({
  tab,
  adminKey,
  resources,
  creating,
  editingId,
  onCreatingChange,
  onEditingIdChange,
}: {
  tab: CatalogTab;
  adminKey: string;
  resources: CatalogResources;
  creating: boolean;
  editingId: number | null;
  onCreatingChange: (value: boolean) => void;
  onEditingIdChange: (value: number | null) => void;
}) {
  const current = resources[tab];

  async function deleteItem(itemTab: CatalogTab, id: number) {
    if (!confirm("Eliminare questo elemento?")) return;
    await deleteCatalogItem(itemTab, id, adminKey);
    await current.refresh();
  }

  const closeForm = () => {
    onCreatingChange(false);
    onEditingIdChange(null);
  };
  const handleSaved = () => {
    closeForm();
    void current.refresh();
  };

  return (
    <>
      {creating && (
        <CreateForm
          tab={tab}
          adminKey={adminKey}
          onSaved={handleSaved}
          onCancel={() => onCreatingChange(false)}
        />
      )}
      <Card>
        <CardContent className="pt-4">
          {current.loading && current.data.length === 0 && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} className="h-12 rounded-lg" />
              ))}
            </div>
          )}
          {!current.loading && current.data.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessun elemento. Creane uno con il pulsante "Nuovo".
            </p>
          )}
          <div className="space-y-1">
            {tab === "sectors" &&
              resources.sectors.data.map((item) =>
                editingId === item.id ? (
                  <SectorForm
                    key={item.id}
                    initial={item}
                    adminKey={adminKey}
                    onSaved={handleSaved}
                    onCancel={() => onEditingIdChange(null)}
                  />
                ) : (
                  <ListRow
                    key={item.id}
                    label={item.name}
                    sub={`${item.trend} - rischio ${item.automationRisk}`}
                    onEdit={() => onEditingIdChange(item.id)}
                    onDelete={() => void deleteItem("sectors", item.id)}
                  />
                ),
              )}
            {tab === "professions" &&
              resources.professions.data.map((item) =>
                editingId === item.id ? (
                  <ProfessionForm
                    key={item.id}
                    initial={item}
                    adminKey={adminKey}
                    onSaved={handleSaved}
                    onCancel={() => onEditingIdChange(null)}
                  />
                ) : (
                  <ListRow
                    key={item.id}
                    label={item.title}
                    sub={`${item.sector} - ${item.salaryRange}`}
                    active={item.isActive}
                    onEdit={() => onEditingIdChange(item.id)}
                    onDelete={() => void deleteItem("professions", item.id)}
                  />
                ),
              )}
            {tab === "education-paths" &&
              resources["education-paths"].data.map((item) =>
                editingId === item.id ? (
                  <EducationForm
                    key={item.id}
                    initial={item}
                    adminKey={adminKey}
                    onSaved={handleSaved}
                    onCancel={() => onEditingIdChange(null)}
                  />
                ) : (
                  <ListRow
                    key={item.id}
                    label={item.path}
                    sub={`${item.type} - ${item.duration} - ${item.cost}`}
                    active={item.isActive}
                    onEdit={() => onEditingIdChange(item.id)}
                    onDelete={() => void deleteItem("education-paths", item.id)}
                  />
                ),
              )}
            {tab === "growth-articles" &&
              resources["growth-articles"].data.map((item) =>
                editingId === item.id ? (
                  <GrowthArticleForm
                    key={item.id}
                    initial={item}
                    adminKey={adminKey}
                    onSaved={handleSaved}
                    onCancel={() => onEditingIdChange(null)}
                  />
                ) : (
                  <ListRow
                    key={item.id}
                    label={item.title}
                    sub={`${item.category} - ${item.difficulty} - ${item.status}`}
                    onEdit={() => onEditingIdChange(item.id)}
                    onDelete={() => void deleteItem("growth-articles", item.id)}
                  />
                ),
              )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function CreateForm({
  tab,
  adminKey,
  onSaved,
  onCancel,
}: {
  tab: CatalogTab;
  adminKey: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  if (tab === "sectors")
    return (
      <SectorForm adminKey={adminKey} onSaved={onSaved} onCancel={onCancel} />
    );
  if (tab === "professions")
    return (
      <ProfessionForm
        adminKey={adminKey}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    );
  if (tab === "education-paths")
    return (
      <EducationForm
        adminKey={adminKey}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    );
  return (
    <GrowthArticleForm
      adminKey={adminKey}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
