declare module '*.css' {
  import type {CSSResultGroup} from 'lit';

  const styles: CSSResultGroup;
  export {styles};
}
