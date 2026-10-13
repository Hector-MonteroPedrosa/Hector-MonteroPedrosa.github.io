/*
  Content of the site. Edit this file, save, and refresh index.html (no server needed).

  Each project:
    cat       "ue" (Unreal) | "unity" (Unity) | "other"
    title, summary, tags
    cover     path to the cover image, e.g. "images/my-game.png". Use 16:9, around 1280x720.
              Leave it out and the card shows a node sketch instead.
    url       page of the game (itch.io, Steam, GitHub, YouTube...). The cover and a button open it.
              Leave it out and the button is hidden.
    button    optional text for the button. Default: "View game".
    color     optional card color, any CSS color: "#7C3AED", "rebeccapurple", "rgb(124 58 237)".
              Leave it out and the color depends on cat.
    engine, role, year   optional, each one is hidden when empty.
    placeholder: true    shows a "Placeholder" badge. Remove it for real projects.

  about, skills and contact feed the About, Toolbox and Contact sections at the bottom.
*/
window.SITE = {
  projects: [
    {
      cat: "ue",
      title: "AlcheMess",
      summary: "Online multiplayer potion-making game in the style of Overcooked, built with Blueprints in Unreal Engine 5.6",
      cover: "src/AlcheMess_Cover.jpg",
      url: "https://store.steampowered.com/app/4772620/AlcheMess/",
      video: "https://youtu.be/36Okbfn41H0",
      color: "#7C3AED",
      engine: "Unreal Engine 5.6",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Online multiplayer", "Blueprints", "UE 5.6"]
    
    },
        {
      cat: "unity",
      title: "One of Us",
      placeholder: false,
      summary: "Story based game, where you have to investigate who was infected by a virus.",
      cover: "src/OneOfUs_Cover.png",
      url: "https://hector-montero.itch.io/one-of-us",
      video: "https://www.youtube.com/watch?v=XXXXXXXXXXX",
      engine: "Unity",
      role: "Gameplay Programmer & Modeling",
      year: "2026",
      tags: ["Dialoge", "Puzzles", "Unity 6"]
    },
    {
      cat: "other",
      title: "PolyGuess",
      placeholder: false,
      summary: "Web multiplayer game where you guess what your friends are 3D modeling in real time",
      cover: "src/PolyGuess_Cover.png",
      url: "https://hector-montero.itch.io/polyguess",
      video: "https://www.youtube.com/watch?v=XXXXXXXXXXX",
      button: "Play Game",
      engine: "Three.js",
      role: "Gameplay & Tools Programmer",
      year: "2026",
      tags: ["Multiplayer", "Real-time sync", "3D Modeling Tools"]
    },

    {
      cat: "unity",
      title: "My Board My Rules",
      placeholder: false,
      summary: "Roguelike bullet hell with Upgrades and Debuffs",
      cover: "src/MBMR_Cover.png",
      url: "https://hector-montero.itch.io/myboardmyrules",
      video: "https://www.youtube.com/watch?v=XXXXXXXXXXX",
      button: "View Page",
      engine: "Unity 6",
      role: "Gameplay Programmer & 3D Modeler",
      year: "2026",
      tags: ["Enemy AI", "Upgrade System", "States"]
    }
  ],

  about: [
    "I'm a gameplay programmer interested in everything between the player pressing a button and the screen responding: controls, states, camera, combat and AI.",
    "I work in both Unreal Engine and Unity, and I like to leave systems tidy so the design team can tweak them without fear."
  ],

  skills: [
    { group: "Engines", items: ["Unreal Engine 5.6", "Blueprints", "Unity"] },
    { group: "Gameplay", items: ["Character controllers", "State machines", "Combat systems", "Enemy AI", "Camera", "Input"] },
    { group: "Workflow", items: ["Git", "Rapid prototyping", "In-game debugging"] }
  ],

  contact: {
    email: "monteropedrosahector@gmail.com",
    socials: [
      //{ label: "GitHub", url: "https://github.com" },
      { label: "LinkedIn", url: "https://www.linkedin.com/in/hectormontero/" },
      { label: "itch.io", url: "https://hector-montero.itch.io/" },
      //{ label: "YouTube", url: "https://www.youtube.com" }
    ]
  }
};
