import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Autograd Explorer — See backpropagation, step by step" },
      { name: "description", content: "Write equations, get a draggable computational graph, and watch gradients flow backward with every chain-rule step explained." },
      { property: "og:title", content: "Autograd Explorer — See backpropagation, step by step" },
      { property: "og:description", content: "An interactive playground for computational graphs, derivatives, the chain rule and PyTorch autograd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppShell,
});
