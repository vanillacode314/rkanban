import { type } from 'arktype';
import { createStore } from 'solid-js/store';

import { throwOnParseError } from './arktype';

function createForm<TSchema extends type.Any<object>>(
	schema: TSchema,
	initial: () => NoInfer<TSchema['inferIn']>
) {
	const [form, setForm] = createStore(throwOnParseError(schema(initial())) as TSchema['infer']);
	const [formErrors, setFormErrors] = createStore<
		Partial<Record<'form' | keyof typeof schema.infer, string[]>>
	>({});
	function resetForm() {
		setForm(throwOnParseError(schema(initial())));
		setFormErrors({});
	}

	return [
		{ form, formErrors },
		{ setForm, setFormErrors, resetForm }
	] as const;
}
export { createForm };
