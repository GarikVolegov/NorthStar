import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Award,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Globe,
  GraduationCap,
  Plus,
  Sparkles,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GeneratedCv } from "./cvTypes";

function TagInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  function add() {
    const val = input.trim();
    if (val && !items.includes(val)) {
      onChange([...items, val]);
    }
    setInput("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-7">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1 text-xs bg-primary/8 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 font-medium"
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="hover:text-destructive ml-0.5"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder || t("cv.addPlaceholder")}
          className="h-8 text-xs rounded-lg"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-lg px-2.5"
          onClick={add}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Edit Section wrapper
function EditBlock({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="p-4 space-y-3 bg-background">{children}</div>}
    </div>
  );
}

// Full Edit Panel
export function EditPanel({
  cv,
  onChange,
}: {
  cv: GeneratedCv;
  onChange: (cv: GeneratedCv) => void;
}) {
  const { t } = useTranslation();
  const set = useCallback(
    (patch: Partial<GeneratedCv>) => onChange({ ...cv, ...patch }),
    [cv, onChange],
  );
  const setPI = (patch: Partial<GeneratedCv["personalInfo"]>) =>
    set({ personalInfo: { ...cv.personalInfo, ...patch } });

  // Experience helpers
  const updateExp = (
    id: string,
    patch: Partial<GeneratedCv["experience"][0]>,
  ) =>
    set({
      experience: cv.experience.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  const addExp = () =>
    set({
      experience: [
        ...cv.experience,
        {
          id: `exp-${Date.now()}`,
          title: "",
          company: "",
          period: "",
          location: "",
          description: "",
          skills: [],
        },
      ],
    });
  const delExp = (id: string) =>
    set({ experience: cv.experience.filter((e) => e.id !== id) });

  // Education helpers
  const updateEdu = (id: string, patch: Partial<GeneratedCv["education"][0]>) =>
    set({
      education: cv.education.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  const addEdu = () =>
    set({
      education: [
        ...cv.education,
        { id: `edu-${Date.now()}`, degree: "", institution: "", year: "" },
      ],
    });
  const delEdu = (id: string) =>
    set({ education: cv.education.filter((e) => e.id !== id) });

  // Language helpers
  const updateLang = (
    i: number,
    patch: Partial<{ language: string; level: string }>,
  ) =>
    set({
      languages: cv.languages.map((l, idx) =>
        idx === i ? { ...l, ...patch } : l,
      ),
    });
  const addLang = () =>
    set({ languages: [...cv.languages, { language: "", level: "" }] });
  const delLang = (i: number) =>
    set({ languages: cv.languages.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      {/* Personal info */}
      <EditBlock icon={User} title={t("cv.personalInfo")}>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["name", t("cv.fullName")],
              ["title", t("cv.professionalTitle")],
              ["email", t("cv.email")],
              ["phone", t("cv.phone")],
              ["location", t("cv.cityCountry")],
              ["linkedin", t("cv.linkedinUrl")],
              ["website", t("cv.website")],
            ] as [keyof GeneratedCv["personalInfo"], string][]
          ).map(([field, label]) => (
            <div
              key={field}
              className={
                field === "title" || field === "linkedin" ? "col-span-2" : ""
              }
            >
              <Label className="text-[11px] text-muted-foreground mb-1 block">
                {label}
              </Label>
              <Input
                value={(cv.personalInfo[field] as string) ?? ""}
                onChange={(e) => setPI({ [field]: e.target.value })}
                className="h-8 text-xs rounded-lg"
                placeholder={label}
              />
            </div>
          ))}
        </div>
      </EditBlock>

      {/* Summary */}
      <EditBlock icon={Sparkles} title={t("cv.professionalProfile")}>
        <Textarea
          value={cv.summary}
          onChange={(e) => set({ summary: e.target.value })}
          className="text-xs rounded-lg min-h-25 resize-none"
          placeholder={t("cv.profilePlaceholder")}
        />
      </EditBlock>

      {/* Experience */}
      <EditBlock
        icon={Briefcase}
        title={t("cv.experienceN", { count: cv.experience.length })}
        defaultOpen={cv.experience.length > 0}
      >
        <div className="space-y-4">
          {cv.experience.map((exp, idx) => (
            <div
              key={exp.id}
              className="border rounded-lg p-3 space-y-2 bg-muted/20"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("cv.experienceRow", { n: idx + 1 })}
                </span>
                <button
                  onClick={() => delExp(exp.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("cv.roleLabel")}
                  </Label>
                  <Input
                    value={exp.title}
                    onChange={(e) =>
                      updateExp(exp.id, { title: e.target.value })
                    }
                    className="h-8 text-xs rounded-lg"
                    placeholder="es. Software Engineer"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("cv.companyLabel")}
                  </Label>
                  <Input
                    value={exp.company}
                    onChange={(e) =>
                      updateExp(exp.id, { company: e.target.value })
                    }
                    className="h-8 text-xs rounded-lg"
                    placeholder={t("cv.companyPlaceholder")}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("cv.periodLabel")}
                  </Label>
                  <Input
                    value={exp.period}
                    onChange={(e) =>
                      updateExp(exp.id, { period: e.target.value })
                    }
                    className="h-8 text-xs rounded-lg"
                    placeholder={t("cv.periodPlaceholder")}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("cv.locationLabel")}
                  </Label>
                  <Input
                    value={exp.location ?? ""}
                    onChange={(e) =>
                      updateExp(exp.id, { location: e.target.value })
                    }
                    className="h-8 text-xs rounded-lg"
                    placeholder={t("cv.locationPlaceholder")}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  {t("cv.descriptionLabel")}
                </Label>
                <Textarea
                  value={exp.description}
                  onChange={(e) =>
                    updateExp(exp.id, { description: e.target.value })
                  }
                  className="text-xs rounded-lg min-h-18 resize-none"
                  placeholder={t("cv.bulletHint")}
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  {t("cv.skillsLabel")}
                </Label>
                <TagInput
                  items={exp.skills}
                  onChange={(skills) => updateExp(exp.id, { skills })}
                  placeholder="es. React, Python..."
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full rounded-lg gap-1.5 h-8"
            onClick={addExp}
          >
            <Plus className="w-3.5 h-3.5" /> {t("cv.addExperience")}
          </Button>
        </div>
      </EditBlock>

      {/* Education */}
      <EditBlock
        icon={GraduationCap}
        title={t("cv.educationN", { count: cv.education.length })}
        defaultOpen={cv.education.length > 0}
      >
        <div className="space-y-3">
          {cv.education.map((edu, idx) => (
            <div
              key={edu.id}
              className="border rounded-lg p-3 space-y-2 bg-muted/20"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("cv.educationRow", { n: idx + 1 })}
                </span>
                <button
                  onClick={() => delEdu(edu.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  {t("cv.degreeLabel")}
                </Label>
                <Input
                  value={edu.degree}
                  onChange={(e) =>
                    updateEdu(edu.id, { degree: e.target.value })
                  }
                  className="h-8 text-xs rounded-lg"
                  placeholder="es. Laurea Magistrale in Informatica"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("cv.institutionLabel")}
                  </Label>
                  <Input
                    value={edu.institution}
                    onChange={(e) =>
                      updateEdu(edu.id, { institution: e.target.value })
                    }
                    className="h-8 text-xs rounded-lg"
                    placeholder={t("cv.institutionPlaceholder")}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    {t("cv.yearLabel")}
                  </Label>
                  <Input
                    value={edu.year}
                    onChange={(e) =>
                      updateEdu(edu.id, { year: e.target.value })
                    }
                    className="h-8 text-xs rounded-lg"
                    placeholder="2022"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">
                  {t("cv.eduNotes")}
                </Label>
                <Input
                  value={edu.description ?? ""}
                  onChange={(e) =>
                    updateEdu(edu.id, { description: e.target.value })
                  }
                  className="h-8 text-xs rounded-lg"
                  placeholder="110/110 con lode"
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full rounded-lg gap-1.5 h-8"
            onClick={addEdu}
          >
            <Plus className="w-3.5 h-3.5" /> {t("cv.addEducation")}
          </Button>
        </div>
      </EditBlock>

      {/* Skills */}
      <EditBlock
        icon={Sparkles}
        title={t("cv.skillsSection")}
        defaultOpen={false}
      >
        <TagInput
          items={cv.skills}
          onChange={(skills) => set({ skills })}
          placeholder="es. Machine Learning..."
        />
      </EditBlock>

      {/* Tools */}
      <EditBlock icon={Wrench} title={t("cv.toolsSection")} defaultOpen={false}>
        <TagInput
          items={cv.tools}
          onChange={(tools) => set({ tools })}
          placeholder="es. TensorFlow, Figma..."
        />
      </EditBlock>

      {/* Languages */}
      <EditBlock
        icon={Globe}
        title={t("cv.languagesSection")}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {cv.languages.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={l.language}
                onChange={(e) => updateLang(i, { language: e.target.value })}
                className="h-8 text-xs rounded-lg flex-1"
                placeholder={t("cv.langName")}
              />
              <Input
                value={l.level}
                onChange={(e) => updateLang(i, { level: e.target.value })}
                className="h-8 text-xs rounded-lg w-28"
                placeholder={t("cv.langLevel")}
              />
              <button
                onClick={() => delLang(i)}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full rounded-lg gap-1.5 h-8"
            onClick={addLang}
          >
            <Plus className="w-3.5 h-3.5" /> {t("cv.addLanguage")}
          </Button>
        </div>
      </EditBlock>

      {/* Certifications */}
      <EditBlock icon={Award} title={t("cv.certsSection")} defaultOpen={false}>
        <TagInput
          items={cv.certifications}
          onChange={(certifications) => set({ certifications })}
          placeholder="es. AWS Solutions Architect..."
        />
      </EditBlock>
    </div>
  );
}

// Modal
