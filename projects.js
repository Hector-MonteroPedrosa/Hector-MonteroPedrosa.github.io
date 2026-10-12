/*
  Content of the site. Edit this file, save, and refresh index.html (no server needed).

  projects[].cat   "ue" (Unreal) | "unity" (Unity) | "other"
  projects[]       engine, role and year are optional: leave them out and that line is hidden.
  projects[]       remove  placeholder: true  once a project is real.
  projects[]       optional  image: "images/my-shot.png"  to show a screenshot/GIF instead of the node sketch.
  about, skills and contact feed the About, Toolbox and Contact sections at the bottom.
*/
window.SITE = {
  projects: [
    {
      id: "ue56-project",
      cat: "ue",
      title: "UE 5.6 Project",
      placeholder: true,
      summary: "A complex project built with Blueprints, with several gameplay systems wired together.",
      engine: "Unreal Engine 5.6",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Blueprints", "UE 5.6", "Gameplay"],
      details: [
        "Say what the game is and what you were responsible for.",
        "Describe the hardest system you solved and how you did it.",
        "Add the outcome: session length, team size, platform."
      ],
      links: [{ label: "Video", url: "https://www.youtube.com" }]
    },
    {
      id: "character-controller",
      cat: "other",
      title: "Character Controller",
      placeholder: true,
      summary: "Movement with coyote time, jump buffering, variable jump height and a Celeste-style dash. Try it at the top of this page.",
      engine: "Unreal & Unity",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Movement", "State machine", "Game feel"],
      details: [
        "Explain which parameters designers can tweak from the editor.",
        "Describe how you separated input from the character states."
      ],
      links: [{ label: "Code", url: "https://github.com" }]
    },
    {
      id: "combat-system",
      cat: "unity",
      title: "Combat System",
      placeholder: true,
      summary: "Chainable attacks, cancel windows and damage with clear feedback for the player.",
      engine: "Unity",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Combos", "Hitboxes", "Animation"],
      details: [
        "Summarize how a new attack is defined without touching the base code.",
        "Include a short GIF of a combo."
      ],
      links: [{ label: "Video", url: "https://www.youtube.com" }]
    },
    {
      id: "enemy-ai",
      cat: "ue",
      title: "Enemy AI",
      placeholder: true,
      summary: "Enemies that patrol, detect the player and switch behavior depending on the situation.",
      engine: "Unreal Engine 5.6",
      role: "Gameplay Programmer",
      year: "2026",
      tags: ["Behavior Tree", "Perception", "States"],
      details: [
        "Explain which decisions the enemy makes and why.",
        "Add how you debugged its behavior."
      ],
      links: [{ label: "Video", url: "https://www.youtube.com" }]
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
