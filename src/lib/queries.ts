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

const PRODUCT_FRAGMENT = `#graphql
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
    {namespace: "custom", key: "cover_palette"}
    {namespace: "custom", key: "genre"}
    {namespace: "custom", key: "authors"}
    {namespace: "custom", key: "publisher"}
    {namespace: "custom", key: "year"}
    {namespace: "custom", key: "binding"}
    {namespace: "custom", key: "pages"}
    {namespace: "custom", key: "provenance"}
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
          products(first: 12) {
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
   Customer Account
   ================================================================ */

export const CUSTOMER_CREATE = `
  mutation CustomerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

export const CUSTOMER_ACCESS_TOKEN_CREATE = `
  mutation CustomerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

export const CUSTOMER_ACCESS_TOKEN_DELETE = `
  mutation CustomerAccessTokenDelete($customerAccessToken: String!) {
    customerAccessTokenDelete(customerAccessToken: $customerAccessToken) {
      deletedAccessToken
      deletedCustomerAccessTokenId
      userErrors {
        field
        message
      }
    }
  }
`;

const CUSTOMER_FRAGMENT = `
  fragment CustomerFields on Customer {
    id
    firstName
    lastName
    email
    phone
    acceptsMarketing
    createdAt
    updatedAt
    defaultAddress {
      id
      address1
      address2
      city
      province
      country
      zip
      phone
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
          phone
          name
        }
      }
    }
    orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
      edges {
        node {
          id
          orderNumber
          processedAt
          financialStatus
          fulfillmentStatus
          totalPrice {
            amount
            currencyCode
          }
          lineItems(first: 5) {
            edges {
              node {
                title
                quantity
                variant {
                  image {
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
  }
`;

export const GET_CUSTOMER = `
  ${CUSTOMER_FRAGMENT}
  query GetCustomer($customerAccessToken: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      ...CustomerFields
    }
  }
`;

export const CUSTOMER_UPDATE = `
  ${CUSTOMER_FRAGMENT}
  mutation CustomerUpdate($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
    customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
      customer {
        ...CustomerFields
      }
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

export const CUSTOMER_ADDRESS_CREATE = `
  mutation CustomerAddressCreate($customerAccessToken: String!, $address: MailingAddressInput!) {
    customerAddressCreate(customerAccessToken: $customerAccessToken, address: $address) {
      customerAddress {
        id
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

export const CUSTOMER_ADDRESS_UPDATE = `
  mutation CustomerAddressUpdate($customerAccessToken: String!, $id: ID!, $address: MailingAddressInput!) {
    customerAddressUpdate(customerAccessToken: $customerAccessToken, id: $id, address: $address) {
      customerAddress {
        id
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

export const CUSTOMER_ADDRESS_DELETE = `
  mutation CustomerAddressDelete($customerAccessToken: String!, $id: ID!) {
    customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
      deletedCustomerAddressId
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;

export const CUSTOMER_DEFAULT_ADDRESS_UPDATE = `
  mutation CustomerDefaultAddressUpdate($customerAccessToken: String!, $addressId: ID!) {
    customerDefaultAddressUpdate(customerAccessToken: $customerAccessToken, addressId: $addressId) {
      customer {
        id
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
`;
