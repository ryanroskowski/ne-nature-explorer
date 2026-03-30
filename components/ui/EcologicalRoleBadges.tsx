interface EcologicalRole {
  isPollinator: boolean;
  pollinatorType?: "primary" | "minor";
  isBeneficial: boolean;
  beneficialRole?: string;
  isPest: boolean;
  pestLevel?: "minor" | "major";
  pestNote?: string;
}

export default function EcologicalRoleBadges({
  role,
}: {
  role: EcologicalRole;
}) {
  const badges: React.ReactNode[] = [];

  if (role.isPollinator) {
    badges.push(
      <span
        key="pollinator"
        title={
          role.pollinatorType === "primary"
            ? "Important pollinator species"
            : "Occasional pollinator"
        }
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-ui font-medium bg-amber-50 text-amber-800 border border-amber-200"
      >
        <span aria-hidden="true">🐝</span>
        Pollinator
      </span>
    );
  }

  if (
    role.isBeneficial &&
    role.beneficialRole &&
    role.beneficialRole !== "pollinator"
  ) {
    const beneficialLabels: Record<string, { label: string; icon: string; title: string }> = {
      predator: {
        label: "Predator",
        icon: "🛡️",
        title: "Beneficial predator — helps control pest populations",
      },
      decomposer: {
        label: "Decomposer",
        icon: "♻️",
        title: "Decomposer — breaks down organic matter and recycles nutrients",
      },
      parasitoid: {
        label: "Parasitoid",
        icon: "🔬",
        title: "Parasitoid — helps control other insect populations",
      },
    };

    const info = beneficialLabels[role.beneficialRole];
    if (info) {
      badges.push(
        <span
          key="beneficial"
          title={info.title}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-ui font-medium bg-sky-50 text-sky-800 border border-sky-200"
        >
          <span aria-hidden="true">{info.icon}</span>
          {info.label}
        </span>
      );
    }
  }

  if (role.isPest) {
    const isMajor = role.pestLevel === "major";
    badges.push(
      <span
        key="pest"
        title={role.pestNote || (isMajor ? "Major pest species" : "Minor pest species")}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-ui font-medium ${
          isMajor
            ? "bg-red-50 text-red-800 border border-red-200"
            : "bg-orange-50 text-orange-700 border border-orange-200"
        }`}
      >
        <span aria-hidden="true">⚠️</span>
        {isMajor ? "Major Pest" : "Pest"}
      </span>
    );
  }

  if (badges.length === 0) return null;

  return <>{badges}</>;
}
