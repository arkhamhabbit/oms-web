export interface CategoryNode {
  id: string
  name: string
  slug: string
  status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'ARCHIVED'
  live: boolean
  children: CategoryNode[]
}

// Shaped like GET /api/admin/categories/tree — see D4.7, D4.8.
export const categoryTreeFixture: CategoryNode[] = [
  {
    id: 'cat-food',
    name: 'Food & Nutrition',
    slug: 'food-nutrition',
    status: 'ACTIVE',
    live: true,
    children: [
      {
        id: 'cat-protein',
        name: 'Protein',
        slug: 'protein',
        status: 'ACTIVE',
        live: true,
        children: [
          {
            id: 'cat-whey',
            name: 'Whey Protein',
            slug: 'whey-protein',
            status: 'ACTIVE',
            live: true,
            children: [],
          },
          {
            id: 'cat-plant-protein',
            name: 'Plant Protein',
            slug: 'plant-protein',
            status: 'IN_REVIEW',
            live: false,
            children: [],
          },
        ],
      },
      {
        id: 'cat-snacks',
        name: 'Snacks',
        slug: 'snacks',
        status: 'ACTIVE',
        live: true,
        children: [
          {
            id: 'cat-bars',
            name: 'Bars',
            slug: 'bars',
            status: 'ACTIVE',
            live: true,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'cat-wearables',
    name: 'Wearables',
    slug: 'wearables',
    status: 'DRAFT',
    live: false,
    children: [
      {
        id: 'cat-bands',
        name: 'Fitness Bands',
        slug: 'fitness-bands',
        status: 'DRAFT',
        live: false,
        children: [],
      },
    ],
  },
  {
    id: 'cat-apparel',
    name: 'Apparel',
    slug: 'apparel',
    status: 'ARCHIVED',
    live: false,
    children: [],
  },
]
