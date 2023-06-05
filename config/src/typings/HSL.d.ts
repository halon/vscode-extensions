declare namespace HSL
{
  interface Collection {
    classes: Class[];
    functions: Function[];
    variables: Variable[];
    keywords: Keyword[];
  }

  interface Variables {
    core: Variable[]
    connect: Variable[];
    disconnect: Variable[];
    helo: Variable[];
    auth: Variable[];
    mailfrom: Variable[];
    rcptto: Variable[];
    eod: Variable[];
    predelivery: Variable[];
    postdelivery: Variable[];
  }

  interface Variable {
    name: string;
    type: string;
    detail: string;
    documentation: string;
    keys?: Variable[];
    example?: string;
    compat?: number;
    deprecated?: boolean;
    freebsd?: boolean;
  }

  interface Functions {
    core: Function[];
    connect: Function[];
    disconnect: Function[];
    helo: Function[];
    auth: Function[];
    mailfrom: Function[];
    rcptto: Function[];
    eod: Function[];
    predelivery: Function[];
    postdelivery: Function[];
  }

  interface Function {
    name: string;
    parameters: Parameters;
    returnType?: string;
    detail: string;
    value: string;
    documentation?: string;
    link: string;
    compat?: number;
    deprecated?: boolean;
    static?: boolean;
    freebsd?: boolean;
  }
  
  interface Classes {
    core: Class[];
    connect: Class[];
    disconnect: Class[];
    helo: Class[];
    auth: Class[];
    mailfrom: Class[];
    rcptto: Class[];
    eod: Class[];
    predelivery: Class[];
    postdelivery: Class[];
  }
  
  interface Class {
    name: string;
    parameters: Parameters;
    detail: string;
    value: string;
    methods: Function[];
    documentation?: string;
    link: string;
    compat?: number;
    deprecated?: boolean;
    freebsd?: boolean;
  }
  
  interface Parameters {
    required: Parameter[];
    optional: Parameter[];
  }

  interface Parameter {
    name: string;
    type: string;
  }

  interface Keyword {
    name: string;
    detail: string;
    value?: string;
    documentation: string;
    link: string;
    snippets?: Snippet[];
  }

  interface Snippet {
    detail: string;
    documentation?: string;
    insertText: string[];
  }
}
