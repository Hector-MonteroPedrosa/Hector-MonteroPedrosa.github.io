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
      title: "UE 5.6 Project",
      placeholder: true,
      summary: "A complex project built with Blueprints, with several gameplay systems wired together.",
      // cover: "images/ue56-project.png",
      url: "https://store.steampowered.com",
      engine: "Unreal Engine 5.6",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Blueprints", "UE 5.6", "Gameplay"]
    },
    {
      cat: "other",
      title: "Character Controller",
      placeholder: true,
      summary: "Movement with coyote time, jump buffering, variable jump height and a Celeste-style dash. Try it at the top of this page.",
      // cover: "images/character-controller.png",
      url: "https://github.com",
      button: "View code",
      color: "#7C3AED",
      engine: "Unreal & Unity",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Movement", "State machine", "Game feel"]
    },
    {
      cat: "unity",
      title: "Combat System",
      placeholder: true,
      summary: "Chainable attacks, cancel windows and damage with clear feedback for the player.",
      // cover: "images/combat-system.png",
      url: "https://itch.io",
      engine: "Unity",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Combos", "Hitboxes", "Animation"]
    },
    {
      cat: "ue",
      title: "Enemy AI",
      placeholder: true,
      summary: "Enemies that patrol, detect the player and switch behavior depending on the situation.",
      // cover: "images/enemy-ai.png",
      url: "https://www.youtube.com",
      button: "Watch video",
      engine: "Unreal Engine 5.6",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Behavior Tree", "Perception", "States"]
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
    email: "your@email.com",
    socials: [
      { label: "GitHub", url: "https://github.com" },
      { label: "LinkedIn", url: "https://www.linkedin.com" },
      { label: "itch.io", url: "https://itch.io" },
      { label: "YouTube", url: "https://www.youtube.com" }
    ]
  }
};
