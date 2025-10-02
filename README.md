# PropertyGoose

A Tenant Referencing Application for lettings agencies.

## Tech Stack

- **Frontend**: Vue 3, TypeScript, Vite, Tailwind CSS, Pinia
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Features

- Multi-tenant architecture with company management
- User authentication and authorization
- Tenant reference creation and management
- Team member invitations and role management
- Company settings management

## Setup

### Prerequisites

- Node.js 18+
- Supabase account

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Add your Supabase credentials to .env
npm run dev
```

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Add your Supabase credentials to .env
npm run dev
```

### Database Setup

Run the following SQL files in your Supabase SQL Editor in order:

1. `database-schema.sql` - Multi-tenancy tables
2. `references-schema.sql` - Tenant references tables
3. `add-company-fields.sql` - Additional company fields

## Brand Colors

- Primary Orange: `#FF8C41`
- Secondary Beige: `#F8F5F0`
- Background White: `#FDFDFD`

## License

Proprietary
