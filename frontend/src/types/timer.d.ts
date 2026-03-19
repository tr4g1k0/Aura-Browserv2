// Fix NodeJS.Timeout vs number type mismatch across the codebase
// In React Native (Hermes runtime), setTimeout/setInterval return a number
// But TypeScript's @types/node types declare them as returning NodeJS.Timeout
// This declaration resolves the type conflict globally
declare namespace NodeJS {
  type Timeout = number;
}
