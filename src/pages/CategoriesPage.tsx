import { useState } from 'react'

import { CategoryTree } from '@/components/tree/CategoryTree'
import { useBreadcrumb } from '@/layouts/breadcrumb-context'
import { categoryTreeFixture } from '@/fixtures/categories'

function CategoriesPage() {
  useBreadcrumb([{ label: 'Categories' }])
  const [data, setData] = useState(categoryTreeFixture)

  return (
    <div className="max-w-xl rounded-lg border p-2">
      <CategoryTree data={data} onChange={setData} />
    </div>
  )
}

export default CategoriesPage
