import cobalt from "@/assets/project-cobalt.jpg";
import glass from "@/assets/project-glass.jpg";
import bloom from "@/assets/project-bloom.jpg";

export const projects = [
  { slug: "after-blue", title: "After Blue", client: "NOMA Editions", year: "2026", type: "Campaign · Art direction", image: cobalt, color: "cobalt", description: "A furniture launch that treats every silhouette like a main character." },
  { slug: "soft-chemistry", title: "Soft Chemistry", client: "Vitra Form", year: "2026", type: "Identity · Photography", image: glass, color: "lime", description: "A luminous identity system shaped by glass, light, and unexpected material pairings." },
  { slug: "bloom-friend", title: "Bloom Friend", client: "Good Day Co.", year: "2025", type: "Character · Campaign", image: bloom, color: "sun", description: "A joyful brand character built to grow from screen to shelf." },
] as const;

export const activities = [
  ["Soft Chemistry", "Round two shared", "12 min ago"],
  ["Bloom Friend", "3 files approved", "Yesterday"],
  ["After Blue", "Production timeline updated", "Mon"],
];
