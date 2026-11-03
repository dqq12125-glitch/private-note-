import { useLayoutEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { StudentDetail } from '../components/detail/StudentDetail'
import { returnToListLater } from './Students'

export function StudentPage() {
  const { id } = useParams()
  // 列表和详情页共用一个滚动区域：打开全屏详情时从顶部开始看，回到列表时再回到原来的位置
  useLayoutEffect(() => {
    returnToListLater()
    const main = document.getElementById('main-scroll')
    if (main) main.scrollTop = 0
  }, [id])
  return (
    <div className="mx-auto max-w-[1700px] p-4 md:p-6">
      <Link to="/students" className="mb-3 inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> 学生列表
      </Link>
      {/* 换学生时整页重新加载，没保存的草稿不会带到别的学生 */}
      <StudentDetail key={id} id={id!} />
    </div>
  )
}
