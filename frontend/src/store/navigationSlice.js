import { createSlice } from '@reduxjs/toolkit'

const navigationSlice = createSlice({
  name: 'navigation',
  initialState: {
    activePage: 'donnees',
  },
  reducers: {
    setActivePage: (state, action) => {
      state.activePage = action.payload
    },
  },
})

export const { setActivePage } = navigationSlice.actions
export default navigationSlice.reducer
