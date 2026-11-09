import type { ReactNode } from 'react';

export function KpiTile({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="kpi__head">
        <p className="kpi__label">{label}</p>
        {icon && (
          <span className="kpi__icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="kpi__value">{value}</div>
      {detail && <p className="kpi__detail">{detail}</p>}
    </div>
  );
}
