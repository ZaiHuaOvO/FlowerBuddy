import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/api'

type LoadState =
  { status: 'loading' } | { status: 'ready'; info: AppInfo } | { status: 'error'; message: string }

const NODE_GLOBAL_CANDIDATES = ['require', 'process', 'module', 'Buffer', 'global'] as const

function detectNodeGlobals(): string[] {
  const scope = globalThis as unknown as Record<string, unknown>
  return NODE_GLOBAL_CANDIDATES.filter((name) => typeof scope[name] !== 'undefined')
}

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [nodeGlobals] = useState<string[]>(detectNodeGlobals)

  useEffect(() => {
    let cancelled = false

    window.petApi
      .getAppInfo()
      .then((info) => {
        if (!cancelled) {
          setState({ status: 'ready', info })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error)
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="shell">
      <header className="hero">
        <span className="stage">阶段 0</span>
        <h1>FlowerBuddy</h1>
        <p className="tagline">工程初始化与技术验证</p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>运行时</h2>
          {state.status === 'loading' && (
            <p className="muted">正在通过 preload 桥读取主进程信息…</p>
          )}
          {state.status === 'error' && <p className="error">无法读取应用信息：{state.message}</p>}
          {state.status === 'ready' && (
            <dl className="facts">
              <div>
                <dt>应用版本</dt>
                <dd>{state.info.version}</dd>
              </div>
              <div>
                <dt>运行模式</dt>
                <dd>{state.info.packaged ? '打包版本' : '开发版本'}</dd>
              </div>
              <div>
                <dt>Electron</dt>
                <dd>{state.info.electron}</dd>
              </div>
              <div>
                <dt>Chromium</dt>
                <dd>{state.info.chrome}</dd>
              </div>
              <div>
                <dt>Node.js（主进程）</dt>
                <dd>{state.info.node}</dd>
              </div>
              <div>
                <dt>平台</dt>
                <dd>
                  {state.info.platform} / {state.info.arch}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="card">
          <h2>安全边界</h2>
          <ul className="checks">
            <li className={typeof window.petApi === 'object' ? 'ok' : 'bad'}>
              contextBridge 已暴露 petApi 命名空间
            </li>
            <li className={nodeGlobals.length === 0 ? 'ok' : 'bad'}>
              {nodeGlobals.length === 0
                ? '渲染进程页面上下文中未暴露 Node.js 全局对象'
                : `渲染进程页面上下文中可见：${nodeGlobals.join('、')}`}
            </li>
            <li
              className={
                state.status === 'ready' ? 'ok' : state.status === 'error' ? 'bad' : 'pending'
              }
            >
              {state.status === 'ready'
                ? '主进程 IPC 握手成功，sender 校验通过'
                : state.status === 'error'
                  ? '主进程 IPC 握手失败'
                  : '正在校验主进程 IPC 握手…'}
            </li>
          </ul>
        </section>
      </main>

      <footer className="note">本窗口仅用于阶段 0 的工程与安全验证，尚未实现任何业务功能。</footer>
    </div>
  )
}
