import { useState } from "react";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const HOLIDAYS: Record<string, string> = {
  "01-01": "元旦",
  "03-08": "妇女节",
  "05-01": "劳动节",
  "06-01": "儿童节",
  "10-01": "国庆节",
  "12-25": "圣诞",
};

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarTool() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = new Date();

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startDow = new Date(year, month, 1).getDay();

  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - startDow + 1);
    const key = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date, out: date.getMonth() !== month, holiday: HOLIDAYS[key] };
  });

  const shift = (delta: number) => setCursor(new Date(year, month + delta, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="hh-tool">
      <div className="hh-tool-head">
        <span className="hh-tool-title">
          {year} 年 {month + 1} 月
        </span>
        <div className="hh-spacer" />
        <button className="hh-btn" data-variant="ghost" onClick={() => shift(-1)}>
          ← 上月
        </button>
        <button className="hh-btn" data-variant="ghost" onClick={goToday}>
          今天
        </button>
        <button className="hh-btn" data-variant="ghost" onClick={() => shift(1)}>
          下月 →
        </button>
      </div>
      <div className="hh-tool-body">
        <div className="hh-cal">
          {WEEKDAYS.map((day) => (
            <div className="hh-cal-dow" key={day}>
              {day}
            </div>
          ))}
          {cells.map((cell, index) => (
            <div
              className="hh-cal-day"
              key={index}
              data-out={cell.out}
              data-today={sameDay(cell.date, today)}
              data-holiday={Boolean(cell.holiday)}
            >
              <span>{cell.date.getDate()}</span>
              {cell.holiday && <small>{cell.holiday}</small>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
