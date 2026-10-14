<script setup lang="ts">
// A hand-laid SVG figure from .vitepress/figures, rendered at build time (the README's PNGs come from the same source).
// The expand button opens it full-screen; Escape or a second click closes it.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { figure } from "../../figures/index.mjs";

const props = defineProps<{ name: string; caption?: string }>();
const html = computed(() => figure(props.name));
const open = ref(false);
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") open.value = false;
};
watch(open, (v) => {
  if (typeof window === "undefined") return;
  document.documentElement.style.overflow = v ? "hidden" : "";
  if (v) window.addEventListener("keydown", onKey);
  else window.removeEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("keydown", onKey);
  document.documentElement.style.overflow = "";
});
</script>

<template>
  <figure class="dg" :class="{ 'dg-open': open }">
    <div v-if="open" class="dg-backdrop" @click="open = false" />
    <div class="dg-frame" tabindex="0" role="group" v-html="html" />
    <button class="dg-zoom" type="button" :aria-label="open ? 'Close the figure' : 'Expand the figure'" @click="open = !open">
      <svg v-if="!open" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
      <svg v-else viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
    </button>
    <figcaption v-if="caption" class="dg-caption">{{ caption }}</figcaption>
  </figure>
</template>
