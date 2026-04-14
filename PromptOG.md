Quiero construir una aplicación web interna (simple, rápida y usable en tienda) para apoyar la definición y validación de recomendaciones de venta cruzada en punto de venta.

Contexto:
La app no es el producto final. Es una herramienta para construir y validar combinaciones de productos que después serán implementadas en el sistema PDV.

El modelo de negocio se basa en venta por soluciones usando 4 componentes:
- Preparado de superficie
- Acabado
- Herramientas / utensilios
- Protección y limpieza

Objetivo de la app:
Permitir que un usuario (comercial / asesor / proyecto) pueda:
1. Ver los productos más vendidos (top productos)
2. Seleccionar un producto base
3. Ver y definir 3–4 productos recomendados (venta cruzada)
4. Validar si esas combinaciones hacen sentido comercial

---

## Funcionalidades clave

### 1. Vista de productos (Home)
- Lista de productos más vendidos (Top 50 aprox)
- Cada producto debe mostrar:
  - Nombre
  - Categoría (opcional)
  - Indicador visual (ej: badge "Top")
- Buscador por nombre o SKU

---

### 2. Selección de producto
- Al dar click en un producto:
  - Navega a una vista de detalle

---

### 3. Vista de recomendaciones
Para un producto seleccionado:

Se deben mostrar 2 secciones:

#### A. Recomendaciones actuales (si existen)
- Lista de productos recomendados
- Máximo 3–4
- Mostrar nombre y categoría

#### B. Editor de recomendaciones
- Permitir agregar productos como recomendación
- Input tipo buscador (autocomplete)
- Botón "Agregar recomendación"
- Permitir eliminar recomendaciones

---

### 4. Clasificación por componentes
Cada producto debe poder clasificarse en uno de los 4:
- Preparado de superficie
- Acabado
- Herramientas / utensilios
- Protección y limpieza

Mostrar esta categoría visualmente (tag o color)

---

### 5. Validación básica
- No permitir más de 4 recomendaciones por producto
- Evitar duplicados
- Opcional: sugerir que haya variedad entre componentes

---

## UX / Diseño

- Interfaz muy simple (tipo dashboard ligero)
- Pensado para uso rápido (no más de 2 clics para ver recomendaciones)
- Diseño limpio, sin sobrecarga
- Priorizar claridad sobre diseño complejo

---

## Tech / Alcance

- Puede ser una app web simple (no móvil nativo)
- No requiere autenticación compleja (puede ser mock)
- Datos pueden ser mockeados inicialmente (JSON)
- Debe ser fácil de evolucionar después

---

## Entregables esperados

1. Estructura de la app (pantallas)
2. Flujo de navegación
3. Componentes principales
4. Ejemplo de datos mock (productos + recomendaciones)
5. UI inicial funcional

---

## Importante

- No sobrecomplicar
- No convertir esto en un sistema enterprise
- Es una herramienta interna de validación, no el producto final
- Debe sentirse rápida, útil y práctica para negocio
