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
    helo: Variable[];
    auth: Variable[];
    mailfrom: Variable[];
    rcptto: Variable[];
    eodonce: Variable[];
    eodrcpt: Variable[];
    predelivery: Variable[];
    postdelivery: Variable[];
    api: Variable[];
    firewall: Variable[];
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
  }

  interface Functions {
    core: Function[];
    connect: Function[];
    helo: Function[];
    auth: Function[];
    mailfrom: Function[];
    rcptto: Function[];
    eodonce: Function[];
    eodrcpt: Function[];
    predelivery: Function[];
    postdelivery: Function[];
    api: Function[];
    firewall: Function[];
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
  }
  
  interface Classes {
    core: Class[];
    connect: Class[];
    helo: Class[];
    auth: Class[];
    mailfrom: Class[];
    rcptto: Class[];
    eodonce: Class[];
    eodrcpt: Class[];
    predelivery: Class[];
    postdelivery: Class[];
    api: Class[];
    firewall: Class[];
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
