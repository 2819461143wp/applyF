<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { VectorResult } from '../../types/domain'
import { displaySourceName } from '../../utils/labels'

const props = defineProps<{
  vectors: VectorResult
  selectedDocId: string
}>()

const vectorZoom = ref(1)
const vectorPan = reactive({ x: 0, y: 0 })
const vectorDragging = ref(false)
const vectorDragStart = reactive({ x: 0, y: 0, panX: 0, panY: 0 })

const vectorSvgPoints = computed(() => {
  const points = props.vectors.points
  if (points.length === 0) return []
  const xs = points.map((item) => item.x)
  const ys = points.map((item) => item.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spreadX = maxX - minX || 1
  const spreadY = maxY - minY || 1
  return points.map((item) => ({
    ...item,
    cx: 36 + ((item.x - minX) / spreadX) * 628,
    cy: 324 - ((item.y - minY) / spreadY) * 288,
    color: item.parser === 'seed' ? '#8aa4b8' : ['#22d3ee', '#2dd4bf', '#f59e0b', '#fb7185'][props.vectors.sources.indexOf(item.source) % 4],
  }))
})
const vectorPointMap = computed(() => new Map(vectorSvgPoints.value.map((point) => [point.id, point])))
const vectorSvgEdges = computed(() =>
  props.vectors.edges
    .map((edge) => {
      const from = vectorPointMap.value.get(edge.from)
      const to = vectorPointMap.value.get(edge.to)
      if (!from || !to) return null
      return {
        ...edge,
        x1: from.cx,
        y1: from.cy,
        x2: to.cx,
        y2: to.cy,
        color: from.color,
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null),
)
const vectorTransform = computed(() => `translate(${vectorPan.x} ${vectorPan.y}) scale(${vectorZoom.value})`)
const visibleChunks = computed(() => {
  const normalizedDocId = props.selectedDocId.replace(/^seed:/, '')
  const selected = props.vectors.points.filter((point) => point.docId === props.selectedDocId || point.docId === normalizedDocId)
  const preferred = selected.length > 0 ? selected : props.vectors.points.filter((point) => point.parser !== 'seed')
  const chunks = preferred.length > 0 ? preferred : props.vectors.points
  return [...chunks].sort((left, right) => left.chunk - right.chunk).slice(0, 12)
})
const chunkHeading = computed(() => {
  const first = visibleChunks.value[0]
  return first ? displaySourceName(first.source) : '暂无向量切片'
})

function zoomVector(delta: number) {
  vectorZoom.value = Math.min(2.8, Math.max(0.55, Number((vectorZoom.value + delta).toFixed(2))))
}

function resetVectorView() {
  vectorZoom.value = 1
  vectorPan.x = 0
  vectorPan.y = 0
}

function onVectorWheel(event: WheelEvent) {
  zoomVector(event.deltaY < 0 ? 0.12 : -0.12)
}

function startVectorPan(event: MouseEvent) {
  vectorDragging.value = true
  vectorDragStart.x = event.clientX
  vectorDragStart.y = event.clientY
  vectorDragStart.panX = vectorPan.x
  vectorDragStart.panY = vectorPan.y
}

function moveVectorPan(event: MouseEvent) {
  if (!vectorDragging.value) return
  vectorPan.x = vectorDragStart.panX + event.clientX - vectorDragStart.x
  vectorPan.y = vectorDragStart.panY + event.clientY - vectorDragStart.y
}

function stopVectorPan() {
  vectorDragging.value = false
}
</script>

<template>
  <div class="knowledge-card vector-card">
    <div class="panel-head">
      <h2>向量可视化</h2>
      <span class="chip solid">总向量 {{ vectors.total }}</span>
    </div>
    <div class="vector-toolbar">
      <span>连线阈值：{{ vectors.similarityThreshold }}</span>
      <span>连线数：{{ vectors.edges.length }}</span>
      <span>文档来源：{{ vectors.sources.length }}</span>
      <span>缩放：{{ Math.round(vectorZoom * 100) }}%</span>
      <div class="vector-zoom-controls">
        <button class="minor tiny" type="button" @click="zoomVector(0.16)">放大</button>
        <button class="minor tiny" type="button" @click="zoomVector(-0.16)">缩小</button>
        <button class="minor tiny" type="button" @click="resetVectorView">重置视图</button>
      </div>
    </div>
    <svg
      :class="['vector-map', { panning: vectorDragging }]"
      viewBox="0 0 700 360"
      role="img"
      aria-label="知识库向量关系可视化"
      @wheel.prevent="onVectorWheel"
      @mousedown="startVectorPan"
      @mousemove="moveVectorPan"
      @mouseup="stopVectorPan"
      @mouseleave="stopVectorPan"
      @dblclick="resetVectorView"
    >
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(125, 211, 252, 0.12)" stroke-width="1" />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="700" height="360" rx="24" />
      <rect x="16" y="16" width="668" height="328" rx="18" fill="url(#grid)" />
      <g :transform="vectorTransform">
        <line
          v-for="edge in vectorSvgEdges"
          :key="`${edge.from}-${edge.to}`"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          :stroke="edge.color"
          :stroke-opacity="0.18 + Math.min(edge.similarity, 1) * 0.42"
          :stroke-width="1 + edge.similarity * 1.5"
        />
        <g v-for="point in vectorSvgPoints" :key="point.id">
          <circle :cx="point.cx" :cy="point.cy" r="8" :fill="point.color" filter="url(#glow)" />
          <title>{{ displaySourceName(point.source) }} / chunk {{ point.chunk }} - {{ point.content }}</title>
        </g>
      </g>
    </svg>
    <div class="vector-legend">
      <span v-for="(source, index) in vectors.sources" :key="source">
        <i :style="{ background: source === 'seed_rules' ? '#8aa4b8' : ['#22d3ee', '#2dd4bf', '#f59e0b', '#fb7185'][index % 4] }"></i>
        {{ displaySourceName(source) }}
      </span>
    </div>
    <div class="chunk-panel">
      <div>
        <h3>当前 chunk：{{ chunkHeading }}</h3>
        <p>点击左侧“已入库文档”可切换这里展示的切片内容；默认优先显示上传文档而非内置规则。</p>
      </div>
    </div>
    <div class="vector-list">
      <article v-for="point in visibleChunks" :key="point.id">
        <strong>{{ displaySourceName(point.source) }}</strong>
        <span>{{ point.parser }} / chunk {{ point.chunk }}</span>
        <p>{{ point.content }}</p>
      </article>
    </div>
  </div>
</template>
