const CART_FRAGMENT = `#graphql
fragment cartFragment on Cart {
  id
  totalQuantity
  checkoutUrl
  cost {
    subtotalAmount {
      amount
      currencyCode
    }
    totalAmount {
      amount
      currencyCode
    }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ...on ProductVariant {
            id
            title
            image {
              url
              altText
              width
              height
            }
            product {
              handle
              title
            }
          }
        }
        cost {
          amountPerQuantity{
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
  }
}
`;

export const PRODUCT_FRAGMENT = `#graphql
fragment productFields on Product {
  id
  title
  handle
  description
  descriptionHtml
  vendor
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  compareAtPriceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  featuredImage {
    url(transform: { maxWidth: 600 })
    altText
    width
    height
  }
  images(first: 10) {
    edges {
      node {
        url(transform: { maxWidth: 1200 })
        altText
        width
        height
      }
    }
  }
  variants(first: 100) {
    edges {
      node {
        id
        title
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
        sku
      }
    }
  }
  metafields(identifiers: [
    {namespace: "app-ibp-book", key: "cover_palette"}
    {namespace: "app-ibp-book", key: "genre"}
    {namespace: "app-ibp-book", key: "authors"}
    {namespace: "app-ibp-book", key: "publisher"}
    {namespace: "app-ibp-book", key: "publication_year"}
    {namespace: "app-ibp-book", key: "binding"}
    {namespace: "app-ibp-book", key: "pages"}
    {namespace: "app-ibp-book", key: "provenance"}
  ]) {
    namespace
    key
    value
    type
  }
}
`;

export const GET_PRODUCT_BY_HANDLE = `
  ${PRODUCT_FRAGMENT}
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      ...productFields
    }
  }
`;


export const GET_PRODUCT_BY_ID = `
  ${PRODUCT_FRAGMENT}
  query GetProductById($id: ID!) {
    node(id: $id) {
      ... on Product {
        ...productFields
      }
    }
  }
`;
export const GET_COLLECTION_BY_HANDLE = `
  ${PRODUCT_FRAGMENT}
  query GetCollection($handle: String!, $first: Int!, $after: String) {
    collection(handle: $handle) {
      id
      title
      descriptionHtml
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            ...productFields
          }
        }
      }
    }
  }
`;

export const GET_ALL_PRODUCTS = `
  ${PRODUCT_FRAGMENT}
  query GetAllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          ...productFields
        }
      }
    }
  }
`;

export const SEARCH_PRODUCTS = `
  ${PRODUCT_FRAGMENT}
  query SearchProducts($query: String!, $first: Int!, $after: String) {
    search(query: $query, first: $first, after: $after, types: PRODUCT) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          ... on Product {
            ...productFields
          }
        }
      }
    }
  }
`;

export const GET_SHOP_INFO = `
  query GetShop {
    shop {
      name
      primaryDomain { url }
      moneyFormat
    }
  }
`;

export const GET_BLOG_BY_HANDLE = `
  query GetBlog($handle: String!, $first: Int!) {
    blog(handle: $handle) {
      id
      title
      articles(first: $first) {
        edges {
          node {
            id
            title
            handle
            excerptHtml
            contentHtml
            publishedAt
            image {
              url(transform: { maxWidth: 600 })
              altText
            }
            author { name }
            metafields(identifiers: [
              {namespace: "custom", key: "volume"}
              {namespace: "custom", key: "related_books"}
            ]) {
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  }
`;

export const GET_ARTICLE_BY_HANDLE = `
  query GetArticle($blogHandle: String!, $articleHandle: String!) {
    blog(handle: $blogHandle) {
      articleByHandle(handle: $articleHandle) {
        id
        title
        contentHtml
        excerptHtml
        publishedAt
        image {
          url(transform: { maxWidth: 1200 })
          altText
        }
        author { name }
        metafields(identifiers: [
          {namespace: "custom", key: "volume"}
          {namespace: "custom", key: "related_books"}
        ]) {
          namespace
          key
          value
          type
        }
      }
    }
  }
`;

export const GET_COLLECTIONS = `
  query GetCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          image {
            url(transform: { maxWidth: 400 })
            altText
          }
          products(first: 250) {
            edges {
              node {
                id
                title
                handle
                featuredImage {
                  url(transform: { maxWidth: 200 })
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_PAGE_BY_HANDLE = `
  query GetPage($handle: String!) {
    page(handle: $handle) {
      id
      title
      body
    }
  }
`;

export const GET_CART = `
  ${CART_FRAGMENT}
  query GetCart($id: ID!) {
    cart(id: $id) {
      ...cartFragment
    }
  }
`;

export const CREATE_CART = `
  ${CART_FRAGMENT}
  mutation CreateCart($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        ...cartFragment
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const ADD_TO_CART = `
  ${CART_FRAGMENT}
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...cartFragment
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const REMOVE_FROM_CART = `
  ${CART_FRAGMENT}
  mutation RemoveFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...cartFragment
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/* ================================================================
   Customer Account API (OAuth)
   ================================================================ */

export const CUSTOMER_ACCOUNTS_CUSTOMER_QUERY = `
  query Customer {
    customer {
      id
      firstName
      lastName
      displayName
      emailAddress {
        emailAddress
        marketingState
      }
      phoneNumber {
        phoneNumber
        marketingState
      }
      defaultAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        name
      }
      addresses(first: 10) {
        edges {
          node {
            id
            address1
            address2
            city
            province
            country
            zip
            name
          }
        }
      }
      orders(first: 10) {
        edges {
          node {
            id
            name
            processedAt
            financialStatus
            fulfillmentStatus
            totalPrice {
              amount
              currencyCode
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const CUSTOMER_ADDRESS_CREATE = `
  mutation customerAddressCreate($address: CustomerAddressInput!) {
    customerAddressCreate(address: $address) {
      customerAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CUSTOMER_ADDRESS_UPDATE = `
  mutation customerAddressUpdate($address: CustomerAddressInput!, $addressId: ID!) {
    customerAddressUpdate(address: $address, addressId: $addressId) {
      customerAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CUSTOMER_ADDRESS_DELETE = `
  mutation customerAddressDelete($addressId: ID!) {
    customerAddressDelete(addressId: $addressId) {
      deletedAddressId
      userErrors {
        field
        message
      }
    }
  }
`;

export const CUSTOMER_DEFAULT_ADDRESS_UPDATE = `
  mutation customerDefaultAddressUpdate($addressId: ID!) {
    customerDefaultAddressUpdate(addressId: $addressId) {
      customer {
        id
        defaultAddress {
          id
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CUSTOMER_WISHLIST_QUERY = `
  query CustomerWishlist {
    customer {
      id
      metafields(identifiers: [
        {namespace: "custom", key: "wishlist"}
      ]) {
        namespace
        key
        value
        type
      }
    }
  }
`;

export const CUSTOMER_WISHLIST_UPDATE = `
  mutation WishlistSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        namespace
        key
        value
        type
      }
      userErrors {
        field
        message
      }
    }
  }
`;
