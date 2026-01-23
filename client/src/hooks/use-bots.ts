import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertBot } from "@shared/routes";

// GET /api/bots
export function useBots() {
  return useQuery({
    queryKey: [api.bots.list.path],
    queryFn: async () => {
      const res = await fetch(api.bots.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Botlar ro\'yxatini yuklab bo\'lmadi');
      return api.bots.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/bots/:id
export function useBot(id: number) {
  return useQuery({
    queryKey: [api.bots.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.bots.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Bot ma\'lumotlarini yuklab bo\'lmadi');
      return api.bots.get.responses[200].parse(await res.json());
    },
  });
}

// POST /api/bots (Assuming we might want an admin panel later, but adding the hook for completeness)
export function useCreateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertBot) => {
      const validated = api.bots.create.input.parse(data);
      const res = await fetch(api.bots.create.path, {
        method: api.bots.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.bots.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Bot yaratib bo\'lmadi');
      }
      return api.bots.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.bots.list.path] }),
  });
}
