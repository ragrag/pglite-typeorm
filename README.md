## About
TypeORM DataSource For PGlite

## API Reference: [https://ragrag.github.io/pglite-typeorm](https://ragrag.github.io/pglite-typeorm)

### Installing

```base
npm install pglite-typeorm
```

### Usage


```typescript
import { DataSource } from 'typeorm';
import { PGliteDriver } from 'pglite-typeorm';
import { type PGliteOptions } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

const pgliteOptions: PGliteOptions = { extensions: {uuid_ossp} };

const dataSource = new DataSource({
    type: 'postgres',
    synchronize: false,
    driver: PGliteDriver(pgliteOptions),
});

await dataSource.initialize();

// use dataSource as you would use a regular typeorm dataSource
```


### Note
```@electric-sql/pglite``` is expected to be installed as this package only includes it as a peer dependency