import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { StudentDetail } from '../components/detail/StudentDetail'

export function StudentPage() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-[1700px] p-4 md:p-6">
      <Link to="/students" className="mb-3 inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> 学生列表
      </Link>
      <StudentDetail id={id!} />
    </div>
  )
}
