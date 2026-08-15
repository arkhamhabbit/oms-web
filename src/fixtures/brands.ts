export interface Brand {
  id: string
  name: string
  slug: string
  status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'ARCHIVED'
  live: boolean
  productCount: number
}

export const brandsFixture: Brand[] = [
  { id: 'brand-habbit', name: 'Habbit', slug: 'habbit', status: 'ACTIVE', live: true, productCount: 42 },
  { id: 'brand-muscleblaze', name: 'MuscleBlaze', slug: 'muscleblaze', status: 'ACTIVE', live: true, productCount: 118 },
  { id: 'brand-optimum', name: 'Optimum Nutrition', slug: 'optimum-nutrition', status: 'ACTIVE', live: true, productCount: 76 },
  { id: 'brand-myprotein', name: 'MyProtein', slug: 'myprotein', status: 'IN_REVIEW', live: false, productCount: 12 },
  { id: 'brand-boldfit', name: 'Boldfit', slug: 'boldfit', status: 'DRAFT', live: false, productCount: 0 },
  { id: 'brand-legacy', name: 'Legacy Nutrition', slug: 'legacy-nutrition', status: 'ARCHIVED', live: false, productCount: 5 },
  { id: 'brand-fastandup', name: 'Fast&Up', slug: 'fast-and-up', status: 'ACTIVE', live: true, productCount: 34 },
  { id: 'brand-yoga-bar', name: 'Yoga Bar', slug: 'yoga-bar', status: 'ACTIVE', live: true, productCount: 21 },
]
