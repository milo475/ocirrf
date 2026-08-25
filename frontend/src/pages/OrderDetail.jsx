import { useParams } from 'react-router'
import PagePlaceholder from './PagePlaceholder'

export default function OrderDetail() {
  const { id } = useParams()
  return <PagePlaceholder title="Захиалгын дэлгэрэнгүй" note={`id: ${id}`} />
}
