/**
 * EL BUSCADOR Y LOS FILTROS DE UNA PESTAÑA DE LA TIENDA.
 *
 * Las tres pestañas con listado —artículos, reservas y facturas— tenían la
 * misma barra copiada tres veces: el mismo `input.search-box`, el mismo
 * `div.filters` y el mismo `map` con la misma plantilla de `chip`. Veinticinco
 * líneas repetidas que además se iban separando: en una el `aria-label` decía
 * una cosa y el `placeholder` otra.
 *
 * Aquí es una sola, y las diferencias que sí importan —qué se busca y qué
 * filtros hay— viajan como datos.
 */
type Props<T extends string> = {
  /** Qué se puede escribir en el buscador. Se usa también como `aria-label`. */
  busca: string
  valor: string
  onBuscar: (v: string) => void
  filtros: readonly (readonly [T, string])[]
  activo: T
  onFiltrar: (f: T) => void
}

export default function ToolbarTienda<T extends string>({
  busca, valor, onBuscar, filtros, activo, onFiltrar,
}: Props<T>) {
  return (
    <div className="toolbar">
      <input
        className="search-box"
        placeholder={busca}
        aria-label={busca}
        value={valor}
        onChange={(e) => onBuscar(e.target.value)}
      />
      <div className="filters">
        {filtros.map(([id, texto]) => (
          <button
            key={id}
            type="button"
            className={`chip${activo === id ? ' chip--active' : ''}`}
            aria-pressed={activo === id}
            onClick={() => onFiltrar(id)}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  )
}
