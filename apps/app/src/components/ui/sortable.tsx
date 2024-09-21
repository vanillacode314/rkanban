import { createSortable, useDragDropContext } from '@thisbeyond/solid-dnd';

export const Sortable = (props) => {
	const sortable = createSortable(props.item);
	const [state] = useDragDropContext()!;
	return (
		<div
			class="sortable"
			classList={{
				'opacity-25': sortable.isActiveDraggable,
				'transition-transform': !!state.active.draggable
			}}
			use:sortable
		>
			{props.item}
		</div>
	);
};
