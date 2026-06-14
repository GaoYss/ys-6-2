import { useMemo, useState } from 'react'
import { AlertTriangle, Filter, Link, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { api } from '../api/client.js'
import { EmptyState } from '../components/EmptyState.jsx'
import { MetricCard } from '../components/MetricCard.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'

const MARGIN_RISK_THRESHOLD = 0.4

const CATEGORIES = ['肉类', '海鲜', '素菜', '主食', '饮品']
const STATUSES = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '在售' },
  { value: 'seasonal', label: '季节' },
  { value: 'paused', label: '暂停' },
]
const RISK_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'low', label: '低毛利风险' },
  { value: 'normal', label: '毛利正常' },
]

const emptyDish = {
  name: '',
  category: '肉类',
  flavor: '原味',
  status: 'active',
  description: '',
}

function getDishMarginInfo(dishId, specifications) {
  const specs = specifications.filter((s) => s.dish_id === dishId)
  if (specs.length === 0) return { hasSpec: false, minMargin: null, isLowMargin: false }
  const minMargin = Math.min(...specs.map((s) => s.gross_margin))
  return { hasSpec: true, minMargin, isLowMargin: minMargin < MARGIN_RISK_THRESHOLD }
}

export function Catalog({ dishes, specifications, refresh, onModuleChange }) {
  const [form, setForm] = useState(emptyDish)
  const [saving, setSaving] = useState(false)

  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterRisk, setFilterRisk] = useState('')

  const hasActiveFilters = filterCategory || filterStatus || filterKeyword || filterRisk

  const clearFilters = () => {
    setFilterCategory('')
    setFilterStatus('')
    setFilterKeyword('')
    setFilterRisk('')
  }

  const dishMarginMap = useMemo(() => {
    const map = {}
    for (const dish of dishes) {
      map[dish.id] = getDishMarginInfo(dish.id, specifications)
    }
    return map
  }, [dishes, specifications])

  const filteredDishes = useMemo(() => {
    let result = dishes
    if (filterCategory) {
      result = result.filter((d) => d.category === filterCategory)
    }
    if (filterStatus) {
      result = result.filter((d) => d.status === filterStatus)
    }
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase()
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(kw) ||
          d.description.toLowerCase().includes(kw) ||
          d.flavor.toLowerCase().includes(kw),
      )
    }
    if (filterRisk) {
      result = result.filter((d) => {
        const info = dishMarginMap[d.id]
        if (filterRisk === 'low') return info.isLowMargin
        if (filterRisk === 'normal') return info.hasSpec && !info.isLowMargin
        return true
      })
    }
    return result
  }, [dishes, filterCategory, filterStatus, filterKeyword, filterRisk, dishMarginMap])

  const stats = useMemo(() => {
    const total = filteredDishes.length
    const activeCount = filteredDishes.filter((d) => d.status === 'active').length
    const lowMarginCount = filteredDishes.filter((d) => dishMarginMap[d.id]?.isLowMargin).length
    const noSpecCount = filteredDishes.filter((d) => !dishMarginMap[d.id]?.hasSpec).length
    const margins = filteredDishes
      .map((d) => dishMarginMap[d.id]?.minMargin)
      .filter((m) => m != null)
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0
    return { total, activeCount, lowMarginCount, noSpecCount, avgMargin }
  }, [filteredDishes, dishMarginMap])

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    await api.createDish(form)
    setForm(emptyDish)
    setSaving(false)
    refresh()
  }

  const pauseDish = async (dish) => {
    await api.updateDish(dish.id, { status: dish.status === 'active' ? 'paused' : 'active' })
    refresh()
  }

  const deleteDish = async (dish) => {
    await api.deleteDish(dish.id)
    refresh()
  }

  const goToSpecs = (dishId) => {
    if (onModuleChange) onModuleChange('specs')
  }

  return (
    <div className="page-grid">
      <section className="metrics">
        <MetricCard label="筛选菜品" value={stats.total} helper={`共 ${dishes.length} 个菜品`} />
        <MetricCard label="在售" value={stats.activeCount} helper="当前可售" />
        <MetricCard
          label="低毛利风险"
          value={stats.lowMarginCount}
          helper={`毛利率 < ${Math.round(MARGIN_RISK_THRESHOLD * 100)}%`}
        />
        <MetricCard
          label="平均毛利率"
          value={`${Math.round(stats.avgMargin * 100)}%`}
          helper={stats.noSpecCount > 0 ? `${stats.noSpecCount} 个未设规格` : '已设规格'}
        />
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="section-title">
            <h2>菜品列表</h2>
            {hasActiveFilters && (
              <button className="filter-clear-btn" type="button" onClick={clearFilters}>
                <X size={14} />
                清除筛选
              </button>
            )}
          </div>

          <div className="filter-bar">
            <div className="filter-bar-left">
              <div className="filter-group">
                <Filter size={15} />
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="">全部分类</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
                  {RISK_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group search-group">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="搜索菜品名称、描述、风味"
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {filteredDishes.length === 0 ? (
            <EmptyState text={hasActiveFilters ? '没有匹配的菜品' : '还没有菜品'} />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>菜品</th>
                    <th>分类</th>
                    <th>风味</th>
                    <th>状态</th>
                    <th>毛利率</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDishes.map((dish) => {
                    const marginInfo = dishMarginMap[dish.id]
                    return (
                      <tr key={dish.id} className={marginInfo.isLowMargin ? 'warning-row' : ''}>
                        <td>
                          <strong>{dish.name}</strong>
                          <small>{dish.description}</small>
                        </td>
                        <td>{dish.category}</td>
                        <td>{dish.flavor}</td>
                        <td><StatusBadge value={dish.status} /></td>
                        <td>
                          {marginInfo.hasSpec ? (
                            <div className={`margin-cell-inline ${marginInfo.isLowMargin ? 'margin-risk' : ''}`}>
                              {marginInfo.isLowMargin && <AlertTriangle size={14} className="risk-icon" />}
                              <span>{Math.round(marginInfo.minMargin * 100)}%</span>
                              {marginInfo.isLowMargin && (
                                <button
                                  className="link-btn"
                                  type="button"
                                  onClick={() => goToSpecs(dish.id)}
                                  title="查看规格明细"
                                >
                                  <Link size={14} />
                                  规格明细
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="no-spec-text">未设规格</span>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => pauseDish(dish)}>
                              {dish.status === 'active' ? '暂停' : '上架'}
                            </button>
                            <button className="danger" type="button" onClick={() => deleteDish(dish)} title="删除">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel side-panel">
          <div className="section-title">
            <h2>新增菜品</h2>
            <Plus size={18} />
          </div>
          <form className="form" onSubmit={submit}>
            <label>
              菜品名称
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
            </label>
            <label>
              分类
              <select value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              风味
              <input value={form.flavor} onChange={(event) => updateField('flavor', event.target.value)} required />
            </label>
            <label>
              状态
              <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                <option value="active">在售</option>
                <option value="seasonal">季节</option>
                <option value="paused">暂停</option>
              </select>
            </label>
            <label>
              描述
              <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows="4" />
            </label>
            <button className="primary" type="submit" disabled={saving}>
              <Save size={16} />
              <span>{saving ? '保存中' : '保存菜品'}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
