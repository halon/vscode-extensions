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
		data: Variable[];
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
		example?: string;
	}

	interface Functions {
		core: Function[];
		connect: Function[];
		helo: Function[];
		auth: Function[];
		mailfrom: Function[];
		rcptto: Function[];
		data: Function[];
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
	}
	
	interface Classes {
		core: Class[];
		connect: Class[];
		helo: Class[];
		auth: Class[];
		mailfrom: Class[];
		rcptto: Class[];
		data: Class[];
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
		documentation: string;
		link: string;
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
		documentation: string;
		link: string;
	}
}
