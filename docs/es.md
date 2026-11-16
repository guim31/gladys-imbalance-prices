# Precios de desvío (Elia, TenneT)

## Qué hace la integración

El precio de desvío liquida, para cada cuarto de hora, la diferencia entre lo
que la red eléctrica había previsto y lo que realmente ocurrió. Algunos
contratos dinámicos de Bélgica y los Países Bajos lo repercuten a sus clientes
(contratos «imbalance», baterías domésticas gestionadas con él). Esta
integración lo lleva a Gladys casi en tiempo real:

- **Bélgica**, mediante Elia Open Data: el precio del cuarto de hora en curso,
  estimado minuto a minuto, y el valor definitivo de cada cuarto de hora
  cerrado;
- **Países Bajos**, mediante la API de TenneT: un precio indicativo calculado
  cada minuto a partir de la energía de balance que activa TenneT.

Solo cubre el precio de desvío. Para los precios del mercado diario (EPEX,
ENTSO-E) o la tarifa de un comercializador, use las integraciones previstas
para ello.

## Requisitos

- Gladys 5.3.0 o posterior.
- Acceso a Internet desde Gladys (opendata.elia.be, api.tennet.eu).
- Solo para los Países Bajos: una clave API de TenneT gratuita. Regístrese en
  [developer.tennet.eu](https://developer.tennet.eu/register/) y cree una
  clave en su cuenta. Bélgica no necesita cuenta.

## Instalación

1. En Gladys, abra **Integraciones → Instalar desde GitHub**.
2. Introduzca `https://github.com/guim31/gladys-imbalance-prices` e instale.

## Configuración

- **Bélgica (Elia)**: marcada por defecto.
- **Clave API de TenneT (Países Bajos)**: déjela vacía para no seguir los
  Países Bajos.
- **Idioma de los nombres**: idioma de los nombres de las funciones y del
  sentido del desequilibrio, fijado al añadir un dispositivo (francés por
  defecto).

Abra luego la pestaña **Descubrir** y añada los dispositivos: uno por zona. La
acción **Consultar los precios ahora** consulta ambas fuentes y muestra el
precio del cuarto de hora en curso: útil para comprobar una clave de TenneT.

## Dispositivos

Cada zona es un dispositivo con estas funciones:

| Función                                | Significado                                                        |
| -------------------------------------- | ------------------------------------------------------------------ |
| Precio del cuarto de hora (€/MWh)      | precio del cuarto de hora en curso, actualizado cada minuto        |
| Precio del cuarto de hora (€/kWh)      | el mismo, dividido entre 1000                                      |
| Precio cuarto de hora anterior (€/MWh) | precio del cuarto de hora que acaba de cerrarse                    |
| Desequilibrio del sistema (MW)         | positivo: la zona tiene excedente; negativo: le falta electricidad |
| Sentido del desequilibrio              | Excedente, Déficit o Equilibrio                                    |
| Cuarto de hora actual                  | inicio del cuarto de hora en curso, hora de Bruselas («14:15»)     |

Gladys no tiene unidad €/MWh ni MW: los nombres de las funciones las llevan.
Un precio negativo significa que consumir durante ese cuarto de hora se paga.

## Escenas

Dos disparadores, en la categoría **Integraciones** del editor de escenas:

- **El precio de desvío pasa a negativo**: el precio estimado del cuarto de
  hora en curso baja de 0 €/MWh.
- **El precio de desvío supera un umbral**: sube por encima de 100, 150, 200,
  300, 500 o 1000 €/MWh.

Ambos pueden limitarse a una zona (vacío: ambas zonas). Cada uno se dispara
cuando el precio cruza el límite, como mucho una vez por cuarto de hora, y no
de nuevo mientras el precio siga del mismo lado. Las acciones siguientes
pueden leer `{{triggerEvent.data.price}}` (€/MWh), `price_kwh`, `zone` y
`quarter_hour`. Para detener un aparato cuando el precio vuelva a subir, use
el disparador del dispositivo («Precio del cuarto de hora (€/MWh) ≥ 0»).

## Panel

El widget **Precios de desvío** muestra, por zona, el precio del cuarto de
hora en curso y del anterior, el desequilibrio del sistema y la curva del día
(que se puede ocultar en los ajustes del widget).

## Fuentes de datos y límites

- **Elia**: conjuntos `ods161` (por minuto) y `ods162` (por cuarto de hora) de
  [Elia Open Data](https://opendata.elia.be), leídos una vez por minuto, y una
  vez por cuarto de hora para los cerrados. El valor en curso es una
  estimación sobre los minutos transcurridos; el del minuto 14 es el valor
  publicado. Elia marca estos datos como «no validados»: el precio liquidado
  aún puede cambiar.
- **TenneT**: «Balance Delta High Res» (`/latest`), leído una vez por minuto
  (uso razonable: 10 por minuto como máximo). El precio se calcula como el
  estado de regulación de TenneT: solo regulación al alza → precio al alza más
  alto, solo a la baja → precio a la baja más bajo, ambas → precio del sentido
  neto, ninguna → precio medio. Es indicativo: el precio liquidado que TenneT
  publica después puede diferir. La curva del día solo empieza cuando arranca
  la integración.
- **Desarrollado sin clave de TenneT: se agradecen sus comentarios.** La parte
  neerlandesa sigue la descripción de la API de TenneT; no se ha podido
  probar con la API real.
- Las horas siguen el reloj de Bruselas y Ámsterdam, sea cual sea la zona
  horaria de Gladys.

## Solución de problemas

- La integración aparece en error: su mensaje indica qué fuente falla (Elia
  inaccesible, clave de TenneT rechazada, TenneT inaccesible). Los últimos
  valores se mantienen en los dispositivos.
- Ningún valor en un dispositivo: debe añadirse desde la pestaña
  **Descubrir**; los primeros valores llegan en un minuto.
- Registros: la página de la integración en Gladys; `LOG_LEVEL=debug` muestra
  cada lectura.

## Créditos

Datos: [Elia Open Data](https://opendata.elia.be) (Elia Transmission Belgium)
y la [API de TenneT](https://developer.tennet.eu) (TenneT TSO B.V.). Esta
integración no tiene relación con Elia ni con TenneT.
