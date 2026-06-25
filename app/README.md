# Channel List Generator — LYNK Cloud & ProCentric Direct

¡Bienvenido al **Channel List Generator**! Esta es una herramienta web de un solo archivo (SPA) desarrollada para administrar, editar masivamente y exportar mapas de canales para sistemas de televisión interactiva hotelera, específicamente:
- **Samsung LYNK Cloud** (Archivos `.json`)
- **LG Pro:Centric Direct** (Archivos `.xml`)

## Características Principales

* **Interfaz Dual Intuitiva:** Cambia fácilmente entre el ecosistema de Samsung y LG con la barra superior.
* **Soporte para IPTV y RF:** Gestiona canales IP (Multicast) y canales RF/Cable (Terrestres) en plataformas independientes.
* **Importación Masiva (Excel/CSV):** Importa cientos de canales de una sola vez desde plantillas de Excel o archivos CSV.
* **Edición en Lote (Batch Edit):** Modifica prefijos de IPs, puertos y configuraciones (Start Channel, Encriptado, etc.) a múltiples canales a la vez.
* **Auditoría Automática:** Detecta canales duplicados, números de canal faltantes, IPs inválidas o falta de configuración *Start Channel* antes de exportar.
* **Importación Inversa:** Sube un archivo `.json` de Samsung o `.xml` de LG ya existente y la herramienta lo leerá automáticamente de regreso a la tabla para que puedas editarlo.
* **Unificación Inteligente (LG):** Posibilidad de exportar y unificar listas de IPTV y RF/Cable en un único archivo XML listo para subir al servidor de ProCentric.

## Cómo Usar la Herramienta

La aplicación no requiere instalación en un servidor web ni dependencias de backend (Node.js, PHP, etc.). Funciona 100% en el lado del cliente (en tu navegador).

1. Abre el archivo `index.html` en cualquier navegador moderno (Google Chrome, Microsoft Edge, Firefox).
2. Selecciona tu plataforma en la esquina superior derecha (**Samsung LYNK Cloud** o **LG ProCentric Direct**).
3. Selecciona el tipo de señal (**IPTV** o **RF / Cable**).
4. Agrega canales manualmente con el botón **"Agregar Canal"**, o descarga la plantilla de Excel (**"Excel Template"**) para llenarla y luego subirla en **"Importar CSV / Excel"**.
5. Realiza tus ediciones directamente en la tabla (puedes hacer clic en las celdas para modificar el texto) o usa la **Edición Masiva**.
6. Haz clic en **"Exportar JSON/XML"** para obtener el archivo que deberás subir al servidor de gestión de tu hotel (Servidor LYNK Cloud o Servidor ProCentric).

## Tecnologías Utilizadas

- **HTML5 & CSS3:** Maquetación moderna, modo oscuro por defecto y diseño "glassmorphism".
- **Vanilla JavaScript:** Toda la lógica de validación, generación de XML/JSON e importación sin usar frameworks pesados (React, Angular).
- **SheetJS:** Librería para la lectura y generación dinámica de plantillas de Microsoft Excel (.xlsx) y CSV de forma local.

## Notas Técnicas

- El almacenamiento es **local** (`localStorage`). Todos los cambios que hagas se guardan automáticamente en tu navegador. Si cierras la pestaña y la vuelves a abrir, tus canales seguirán ahí.
- **Privacidad:** Ningún dato se envía a la nube ni a servidores externos. Toda la conversión y generación de archivos ocurre en tu computadora.

---

*Aplicación desarrollada de forma independiente y sin fines de lucro por **Cristian Gonzalez A.**.*
*Esta herramienta no tiene afiliación oficial con las marcas Samsung Electronics o LG Electronics.*
