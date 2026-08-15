export interface ProductVariant {
  id: string
  skuCode: string
  optionSignature: string
  mrpMinor: number
  basePriceMinor: number
  currency: string
  batchTracked: boolean
}

export interface Product {
  id: string
  name: string
  brand: string
  category: string
  status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' | 'ARCHIVED'
  live: boolean
  variants: ProductVariant[]
}

// Every product has >=1 variant — D4.9. Money is minor units + ISO currency — D3.2.
export const productsFixture: Product[] = [
  {
    id: 'prod-whey-gold',
    name: 'Whey Gold Standard',
    brand: 'Optimum Nutrition',
    category: 'Whey Protein',
    status: 'ACTIVE',
    live: true,
    variants: [
      {
        id: 'var-whey-gold-1kg-choc',
        skuCode: 'ON-WG-1KG-CHOC',
        optionSignature: 'Weight: 1kg / Flavour: Chocolate',
        mrpMinor: 449900,
        basePriceMinor: 399900,
        currency: 'INR',
        batchTracked: true,
      },
      {
        id: 'var-whey-gold-2kg-choc',
        skuCode: 'ON-WG-2KG-CHOC',
        optionSignature: 'Weight: 2kg / Flavour: Chocolate',
        mrpMinor: 849900,
        basePriceMinor: 759900,
        currency: 'INR',
        batchTracked: true,
      },
      {
        id: 'var-whey-gold-1kg-vanilla',
        skuCode: 'ON-WG-1KG-VAN',
        optionSignature: 'Weight: 1kg / Flavour: Vanilla',
        mrpMinor: 449900,
        basePriceMinor: 399900,
        currency: 'INR',
        batchTracked: true,
      },
    ],
  },
  {
    id: 'prod-fitness-band',
    name: 'Habbit Fit Band 2',
    brand: 'Habbit',
    category: 'Fitness Bands',
    status: 'DRAFT',
    live: false,
    variants: [
      {
        id: 'var-fitband-black',
        skuCode: 'HB-FB2-BLK',
        optionSignature: 'Colour: Black',
        mrpMinor: 299900,
        basePriceMinor: 249900,
        currency: 'INR',
        batchTracked: false,
      },
    ],
  },
  {
    id: 'prod-protein-bar',
    name: 'Chocolate Chip Protein Bar',
    brand: 'Yoga Bar',
    category: 'Bars',
    status: 'ACTIVE',
    live: true,
    variants: [
      {
        id: 'var-bar-single',
        skuCode: 'YB-PB-CHOC-1',
        optionSignature: 'Pack Size: 1',
        mrpMinor: 6900,
        basePriceMinor: 5900,
        currency: 'INR',
        batchTracked: true,
      },
      {
        id: 'var-bar-pack6',
        skuCode: 'YB-PB-CHOC-6',
        optionSignature: 'Pack Size: 6',
        mrpMinor: 39900,
        basePriceMinor: 33900,
        currency: 'INR',
        batchTracked: true,
      },
    ],
  },
]
