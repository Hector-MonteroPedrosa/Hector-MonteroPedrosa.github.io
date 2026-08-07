/* =========================================================================
   FIREBASE-CONFIG.JS
   Este es el ÚNICO archivo que tienes que tocar para activar las salas
   multijugador. Sin esto, la app funciona perfectamente en modo local
   (un jugador, sin sala) — el modo local NO necesita nada de esto.

   CÓMO CONSEGUIR TUS CREDENCIALES GRATIS (5 minutos, sin tarjeta):
   1. Ve a https://console.firebase.google.com/ e inicia sesión con una
      cuenta de Google.
   2. "Crear un proyecto" -> ponle el nombre que quieras -> puedes
      desactivar Google Analytics (no hace falta) -> Crear proyecto.
   3. En la pantalla del proyecto, pulsa el icono "</>" (Añadir app web).
      Ponle un apodo y pulsa "Registrar app".
   4. Firebase te mostrará un objeto `firebaseConfig` - cópialo y pégalo
      abajo, reemplazando el de ejemplo.
   5. En el menú lateral: "Compilación" -> "Realtime Database" ->
      "Crear base de datos" -> elige la ubicación -> empieza en
      "modo de prueba" (permite lectura/escritura durante 30 días).
   6. IMPORTANTE (para que no deje de funcionar en 30 días): dentro de
      Realtime Database -> pestaña "Reglas", pega esto y publica:
        {
          "rules": {
            "rooms": { "$roomId": { ".read": true, ".write": true } }
          }
        }
      Esto abre solo la ruta "rooms" (sin datos sensibles) para que
      cualquiera pueda crear/unirse a salas gratis, para siempre.

   Con eso ya está: guarda este archivo y recarga la página.
   ========================================================================= */

   const firebaseConfig = {
    apiKey: "AIzaSyBfQAERsXGC80W3ZYXIYn-RdDWI5mQvw54",
    authDomain: "polyguess1.firebaseapp.com",
    projectId: "polyguess1",
    storageBucket: "polyguess1.firebasestorage.app",
    messagingSenderId: "3630880695",
    appId: "1:3630880695:web:b86039b51d24b242647a32",
    measurementId: "G-Z4V85LHQFJ"
  };
