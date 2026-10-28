export default function DateFactoryFilters({
  date,
  onDateChange,
  factory,
  onFactoryChange,
  factories,
}) {
  return (
    <div className="date-factory-filters" aria-label="날짜 및 공장 선택">
      <label>
        <span className="sr-only">날짜</span>
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </label>
      <span className="separator" aria-hidden="true">·</span>
      <label>
        <span className="sr-only">공장</span>
        <select
          value={factory}
          onChange={(event) => onFactoryChange(event.target.value)}
        >
          {factories.map((factoryName) => (
            <option key={factoryName} value={factoryName}>{factoryName}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
