/** Pull a human message out of a failed fetch Response. */
export const readErrorMessage = async (res: Response): Promise<string> => {
	try {
		const data = await res.json();
		if (data && typeof data.message === 'string') return data.message;
	} catch {
		/* body was not JSON */
	}
	return `Unexpected error (${res.status})`;
};
