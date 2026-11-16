import FilterMenu from './filter-menu.jsx';
import Icon from './icon.jsx';

/**
 * 하나 고르는 필터 드롭다운 (FilterMenu 틀). options: [{ value, label }], 첫 값('')이 "전체".
 * 고르면 바로 적용하고 닫힌다.
 */
export default function OptionMenu({ label, value, options, onPick, width = 220 }) {
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <FilterMenu label={label} value={current?.label ?? '전체'} active={Boolean(value)} width={width}>
      {(close) => (
        <div className="work-check-menu" role="radiogroup" aria-label={label}>
          {options.map((option) => (
            <button key={option.value || 'all'} type="button" role="radio" aria-checked={value === option.value} className="work-check-menu__option"
              onClick={() => { onPick(option.value); close(); }}>
              <span className="work-check-menu__mark">{value === option.value && <Icon name="check" size={14} />}</span>{option.label}
            </button>
          ))}
        </div>
      )}
    </FilterMenu>
  );
}
